import { formatFileSize } from './format';
import type { DesignState, HoldingDesign, Phase, PortalFileState, StoredFile, Timing } from '../types';

/** Airtable's upload attachment endpoint rejects files over about 5 MB. */
export const AIRTABLE_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

export const TOO_LARGE_MESSAGE =
  "This file is over 5 MB, so it can't be stored on your booking. Please email or text it to Stomp Sphere. We've noted the file name and size.";

export const UPLOAD_FAILED_MESSAGE = "Couldn't upload this file. Please try again.";

export const OTHER_DEVICE_FILE_NOTE =
  'This file is saved on another device. Please add it again here or email it to Stomp Sphere.';

export const REMOVE_FAILED_MESSAGE = "Couldn't remove this file from your booking. Please try again.";

export const HEIC_FAILED_MESSAGE =
  "We couldn't read this HEIC photo. Please export it as a JPEG and try again.";

export const PREVIEW_FAILED_MESSAGE =
  "Couldn't update the floor preview for Stomp. Your answers are still saved.";

/**
 * What the file is for. The server turns this into the staff label.
 * The browser never chooses the label text.
 */
export const UPLOAD_ROLES = [
  'holding-pre',
  'holding-post',
  'holding-dancing',
  'media-start',
  'media-middle',
  'media-end',
  'invite',
  'invite-preview',
] as const;

export type UploadRole = (typeof UPLOAD_ROLES)[number];

/** Staff facing labels. Hyphens here are part of the word, not separators. */
export const UPLOAD_LABELS: Record<UploadRole, string> = {
  'holding-pre': 'Holding screen pre-bridal',
  'holding-post': 'Holding screen post-bridal',
  'holding-dancing': 'Holding screen dancing',
  'media-start': 'Media start of night',
  'media-middle': 'Media middle of night',
  'media-end': 'Media end of night',
  invite: 'Invite or styling',
  'invite-preview': 'Invite preview',
};

const ROLE_SET = new Set<string>(UPLOAD_ROLES);

const EXTENSION_TYPES: Record<string, string> = {
  heic: 'image/heic',
  heif: 'image/heif',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  pdf: 'application/pdf',
};

const FILE_STATES = new Set<PortalFileState>(['local', 'uploading', 'saved', 'error', 'too_large']);

export function isUploadRole(value: string): value is UploadRole {
  return ROLE_SET.has(value);
}

export function roleForPhase(phase: Phase): UploadRole {
  if (phase === 'after') return 'holding-post';
  if (phase === 'dancing') return 'holding-dancing';
  return 'holding-pre';
}

export function roleForTiming(timing: Timing): UploadRole {
  if (timing === 'middle') return 'media-middle';
  if (timing === 'end') return 'media-end';
  return 'media-start';
}

/** Use the file extension when a phone sends an empty type or a generic one. */
export function fileMime(file: { name: string; type: string }): string {
  const type = file.type.trim().toLowerCase();
  if (type === 'image/jpg') return 'image/jpeg';
  if (type && type !== 'application/octet-stream') return type;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_TYPES[ext] ?? type;
}

/** Videos and PDFs cannot be reduced on the server, so they are not sent when they are over 5 MB. */
export function blocksBeforeUpload(file: { type: string; size: number }): string | null {
  const type = fileMime({ name: '', type: file.type });
  const bulky = type.startsWith('video/') || type === 'application/pdf';
  if (bulky && file.size > AIRTABLE_UPLOAD_MAX_BYTES) return TOO_LARGE_MESSAGE;
  return null;
}

/** Original file name made safe to sit inside the attachment label. */
export function safeOriginalName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? '';
  const cleaned = base
    .replace(/\s+-\s+/g, ' ')
    .replace(/[^\w.\- ]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return cleaned || 'file';
}

export function jpegFilename(name: string): string {
  const base = safeOriginalName(name).replace(/\.[A-Za-z0-9]+$/, '');
  return `${base || 'photo'}.jpg`;
}

/** Attachment name staff see in Airtable, for example "Holding screen pre-bridal (photo.jpg)". */
export function attachmentFilename(label: string, originalName: string): string {
  return `${label} (${safeOriginalName(originalName)})`;
}

export interface PortalFileSlot {
  role: UploadRole;
  file: StoredFile;
}

export function listPortalFiles(design: DesignState): PortalFileSlot[] {
  const slots: PortalFileSlot[] = [];
  const add = (file: StoredFile | null | undefined, role: UploadRole) => {
    if (!file || typeof file.id !== 'string' || !file.id) return;
    slots.push({ role, file });
  };
  add(design.designs?.holding?.media, 'holding-pre');
  add(design.designs?.after?.media, 'holding-post');
  add(design.designs?.dancing?.media, 'holding-dancing');
  add(design.invite, 'invite');
  add(design.invitePreview, 'invite-preview');
  for (const item of design.media ?? []) {
    add(item?.file, roleForTiming(item?.timing ?? 'start'));
  }
  return slots;
}

/** Still only on this device, or a previous send failed. Oversized files are already noted. */
export function fileNeedsUpload(file: StoredFile): boolean {
  if (file.attachmentId) return false;
  if (file.uploadState === 'too_large') return false;
  return true;
}

export function migrationCandidates(design: DesignState): PortalFileSlot[] {
  const seen = new Set<string>();
  const out: PortalFileSlot[] = [];
  for (const slot of listPortalFiles(design)) {
    if (!fileNeedsUpload(slot.file) || seen.has(slot.file.id)) continue;
    seen.add(slot.file.id);
    out.push(slot);
  }
  return out;
}

export function mapStoredFiles(
  design: DesignState,
  map: (file: StoredFile, role: UploadRole) => StoredFile,
): DesignState {
  const apply = (file: StoredFile | null, role: UploadRole): StoredFile | null => {
    if (!file) return file;
    const next = map(file, role);
    return next === file ? file : next;
  };
  const holdingMedia = apply(design.designs.holding.media, 'holding-pre');
  const afterMedia = apply(design.designs.after.media, 'holding-post');
  const dancingMedia = apply(design.designs.dancing.media, 'holding-dancing');
  const invite = apply(design.invite, 'invite');
  const invitePreview = apply(design.invitePreview, 'invite-preview');
  let mediaChanged = false;
  const media = design.media.map((item) => {
    const role = roleForTiming(item.timing);
    const file = apply(item.file, role);
    if (!file || file === item.file) return item;
    mediaChanged = true;
    const kind = file.type.startsWith('video/') ? 'video' : file.type.startsWith('image/') ? 'image' : item.kind;
    return { ...item, file, kind };
  });
  if (
    holdingMedia === design.designs.holding.media &&
    afterMedia === design.designs.after.media &&
    dancingMedia === design.designs.dancing.media &&
    invite === design.invite &&
    invitePreview === design.invitePreview &&
    !mediaChanged
  ) {
    return design;
  }
  const holding = retitle(design.designs.holding, holdingMedia);
  const after = retitle(design.designs.after, afterMedia);
  const dancing = retitle(design.designs.dancing, dancingMedia);
  return { ...design, designs: { holding, after, dancing }, invite, invitePreview, media };
}

function retitle(holding: HoldingDesign, media: StoredFile | null): HoldingDesign {
  if (media === holding.media) return holding;
  return { ...holding, media };
}

export function withFilePatch(design: DesignState, fileId: string, patch: Partial<StoredFile>): DesignState {
  if (!fileId) return design;
  return mapStoredFiles(design, (file) => (file.id === fileId ? { ...file, ...patch } : file));
}

/**
 * A stale save must not wipe an attachment id already stored for the same file.
 * Names, times, and every other answer stay as the couple posted them.
 */
export function preserveStoredFiles(posted: DesignState, stored: DesignState | null): DesignState {
  if (!stored) return posted;
  const previous = new Map(listPortalFiles(stored).map((slot) => [slot.file.id, slot.file]));
  return mapStoredFiles(posted, (file) => mergeStoredFile(file, previous.get(file.id)));
}

function mergeStoredFile(file: StoredFile, prior: StoredFile | undefined): StoredFile {
  if (!prior || prior.id !== file.id) return file;
  if (prior.attachmentId && !file.attachmentId) {
    return {
      ...file,
      attachmentId: prior.attachmentId,
      uploadState: 'saved',
      uploadError: null,
      uploadedAt: prior.uploadedAt ?? file.uploadedAt ?? null,
      name: prior.name || file.name,
      type: prior.type || file.type,
      size: prior.size || file.size,
    };
  }
  // Saved by name only. An open on another device must not rewrite that metadata.
  if (!prior.attachmentId && file.name === prior.name && file.type === prior.type && file.size === prior.size) {
    return { ...prior };
  }
  return file;
}

/**
 * Keep invite and colour fields the server already has when this save does not change them.
 * A real removal sets `inviteCleared` and is kept. The flag itself is not stored.
 */
export function mergePortalAnswers(posted: DesignState, stored: DesignState | null): DesignState {
  const next: DesignState = { ...preserveStoredFiles(posted, stored) };
  delete next.inviteCleared;
  if (!stored || (posted.inviteCleared === true && posted.invite == null)) return next;
  if (posted.invite == null && stored.invite != null) next.invite = stored.invite;
  if (next.invite && posted.invitePreview == null && stored.invitePreview != null) next.invitePreview = stored.invitePreview;
  if (next.invite && posted.invitePalette.length === 0 && stored.invitePalette.length > 0) {
    next.invitePalette = stored.invitePalette;
  }
  if (next.invite && posted.inviteNamesColour == null && stored.inviteNamesColour) {
    next.inviteNamesColour = stored.inviteNamesColour;
  }
  if (next.invite && posted.invitePaper == null && stored.invitePaper) next.invitePaper = stored.invitePaper;
  return next;
}

export type UploadOutcome =
  | {
      ok: true;
      kind: 'saved';
      attachmentId: string;
      name: string;
      type: string;
      size: number;
      uploadedAt: string;
    }
  | { ok: true; kind: 'local' }
  | { ok: true; kind: 'skip' }
  | { ok: false; kind: 'too_large'; message: string; notedAt: string }
  | { ok: false; kind: 'error'; message: string; notedAt: string };

export interface SlotReplacement {
  /** What the single slot shows once this attempt is applied. */
  slot: StoredFile | null;
  /** A rejected or in-progress file shown beside a file that is already saved. */
  pending: StoredFile | null;
  /** The previous file to delete, and only after the replacement has actually saved. */
  remove: StoredFile | null;
}

/** A file the booking already has, or a demo copy that was saved on this device. */
function slotIsSaved(file: StoredFile | null): file is StoredFile {
  if (!file) return false;
  if (file.uploadState === 'saved' || file.uploadState === 'local') return true;
  return !!file.attachmentId && file.uploadState !== 'error' && file.uploadState !== 'too_large';
}

function attemptIsSaved(file: StoredFile): boolean {
  return file.uploadState === 'saved' || file.uploadState === 'local';
}

/**
 * A single slot such as the holding screen photo.
 * The saved file and its attachment stay put until the replacement has saved.
 * A rejection or a failed send is reported beside it, and nothing is removed.
 */
export function replaceSingleSlot(current: StoredFile | null, attempt: StoredFile): SlotReplacement {
  if (attemptIsSaved(attempt)) {
    return {
      slot: attempt,
      pending: null,
      remove: current && current.id !== attempt.id ? current : null,
    };
  }
  if (!slotIsSaved(current)) {
    return { slot: attempt, pending: null, remove: null };
  }
  return { slot: current, pending: attempt, remove: null };
}

export function outcomeToPatch(outcome: UploadOutcome): Partial<StoredFile> | null {
  if (outcome.kind === 'skip') return null;
  if (outcome.ok && outcome.kind === 'saved') {
    return {
      attachmentId: outcome.attachmentId,
      uploadState: 'saved',
      uploadError: null,
      uploadedAt: outcome.uploadedAt,
      name: outcome.name,
      type: outcome.type,
      size: outcome.size,
    };
  }
  if (outcome.ok && outcome.kind === 'local') {
    return { uploadState: 'local', uploadError: null, attachmentId: null };
  }
  if (outcome.kind === 'too_large') {
    return { uploadState: 'too_large', uploadError: outcome.message, attachmentId: null, uploadedAt: outcome.notedAt };
  }
  return { uploadState: 'error', uploadError: outcome.message, uploadedAt: outcome.notedAt };
}

export function isPortalFileState(value: string): value is PortalFileState {
  return FILE_STATES.has(value as PortalFileState);
}

/** Australia/Perth, no daylight saving. Example: 4 Nov 2026 9:30 am AWST. */
export function formatPerth(iso: string): string {
  const when = new Date(iso);
  if (!Number.isFinite(when.getTime())) return 'time not recorded';
  const date = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Perth',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(when);
  const time = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Perth',
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: 'h12',
  }).format(when);
  return `${date} ${time} AWST`;
}

function statusPhrase(file: StoredFile): string {
  if (file.attachmentId && file.uploadState !== 'too_large' && file.uploadState !== 'error') return 'saved';
  if (file.uploadState === 'too_large') return 'not uploaded (over 5 MB, please email or text Stomp Sphere)';
  if (file.uploadState === 'error') return 'not uploaded (the last try failed)';
  return 'not uploaded yet';
}

/** One line per file for the Portal uploads list field. */
export function portalUploadsList(design: DesignState): string {
  return listPortalFiles(design)
    .map((slot) => {
      const file = slot.file;
      const when = file.uploadedAt ? formatPerth(file.uploadedAt) : 'time not recorded';
      return `${UPLOAD_LABELS[slot.role]}, ${file.name}, ${file.type}, ${formatFileSize(file.size)}, ${when}, ${statusPhrase(file)}`;
    })
    .join('\n');
}

export function fileStatusLabel(
  file: StoredFile,
  serverSync: boolean,
): { tone: 'muted' | 'error'; text: string; retry: boolean } | null {
  if (!serverSync) {
    if (file.uploadState === 'error' || file.uploadState === 'too_large') {
      return { tone: 'error', text: file.uploadError || UPLOAD_FAILED_MESSAGE, retry: file.uploadState === 'error' };
    }
    return { tone: 'muted', text: 'Saved on this device', retry: false };
  }
  if (file.uploadState === 'uploading') return { tone: 'muted', text: 'Uploading…', retry: false };
  if (!file.uploadState || file.uploadState === 'local') {
    if (file.attachmentId) return { tone: 'muted', text: 'Saved', retry: false };
    if (file.uploadState === 'local') return { tone: 'muted', text: 'Saved on this device', retry: false };
    return null;
  }
  if (file.uploadState === 'saved' || file.attachmentId) return { tone: 'muted', text: 'Saved', retry: false };
  if (file.uploadState === 'too_large') return { tone: 'error', text: file.uploadError || TOO_LARGE_MESSAGE, retry: false };
  return { tone: 'error', text: file.uploadError || UPLOAD_FAILED_MESSAGE, retry: true };
}

export interface MigrationUpload {
  fileId: string;
  blob: Blob;
  role: UploadRole;
  name: string;
  type: string;
}

/**
 * Sends files that are still only in this browser. Patches file records and leaves every other answer as it is.
 */
export async function runPortalFileMigration(opts: {
  design: DesignState;
  readBlob: (fileId: string) => Promise<Blob | null>;
  upload: (input: MigrationUpload) => Promise<UploadOutcome>;
  onPatch: (fileId: string, patch: Partial<StoredFile>) => void;
}): Promise<void> {
  for (const slot of migrationCandidates(opts.design)) {
    const blob = await opts.readBlob(slot.file.id);
    // No blob on this device. Leave name-only metadata untouched and do not report an error.
    if (!blob) continue;
    opts.onPatch(slot.file.id, { uploadState: 'uploading', uploadError: null });
    const outcome = await opts.upload({
      fileId: slot.file.id,
      blob,
      role: slot.role,
      name: slot.file.name,
      type: slot.file.type || blob.type,
    });
    if (outcome.kind === 'skip') continue;
    const patch = outcomeToPatch(outcome);
    if (patch) opts.onPatch(slot.file.id, patch);
  }
}
