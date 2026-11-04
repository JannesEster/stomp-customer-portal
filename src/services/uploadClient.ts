import {
  UPLOAD_FAILED_MESSAGE,
  blocksBeforeUpload,
  fileMime,
  type UploadOutcome,
  type UploadRole,
} from '../lib/portalFiles';

const ATTACHMENT_ID = /^att[A-Za-z0-9]{14}$/;

const shared = new Map<string, Promise<UploadOutcome>>();

/** One send per file while a page is open, so a repeated visit effect does not store the file twice. */
export function sharePortalUpload(key: string, run: () => Promise<UploadOutcome>): Promise<UploadOutcome> {
  const existing = shared.get(key);
  if (existing) return existing;
  const promise = run().then(
    (outcome) => {
      if (!outcome.ok || outcome.kind !== 'saved') shared.delete(key);
      return outcome;
    },
    (err: unknown) => {
      shared.delete(key);
      throw err;
    },
  );
  shared.set(key, promise);
  return promise;
}

export async function uploadPortalFile(opts: {
  token: string | null;
  file: Blob;
  filename: string;
  type: string;
  role: UploadRole;
  fetchImpl?: typeof fetch;
  now?: () => string;
}): Promise<UploadOutcome> {
  const now = opts.now ?? (() => new Date().toISOString());
  if (!opts.token) return { ok: true, kind: 'local' };
  const type = fileMime({ name: opts.filename, type: opts.type || opts.file.type });
  const blocked = blocksBeforeUpload({ type, size: opts.file.size });
  if (blocked) return { ok: false, kind: 'too_large', message: blocked, notedAt: now() };

  const fetchImpl = opts.fetchImpl ?? fetch;
  let response: Response;
  try {
    const body = new FormData();
    body.set('role', opts.role);
    const named = opts.file instanceof File ? opts.file : new File([opts.file], opts.filename, { type });
    body.set('file', named, opts.filename);
    response = await fetchImpl(`/api/portal/${encodeURIComponent(opts.token)}/uploads`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body,
    });
  } catch {
    return { ok: false, kind: 'error', message: UPLOAD_FAILED_MESSAGE, notedAt: now() };
  }

  const payload = await readJson(response);
  if (!response.ok || !payload) {
    return { ok: false, kind: errorKind(response.status, payload), message: messageFrom(payload, response.status), notedAt: now() };
  }
  const attachmentId = payload.attachmentId;
  if (typeof attachmentId !== 'string' || !ATTACHMENT_ID.test(attachmentId)) {
    return { ok: false, kind: 'error', message: UPLOAD_FAILED_MESSAGE, notedAt: now() };
  }
  return {
    ok: true,
    kind: 'saved',
    attachmentId,
    name: typeof payload.name === 'string' && payload.name ? payload.name : opts.filename,
    type: typeof payload.type === 'string' && payload.type ? payload.type : type,
    size: typeof payload.size === 'number' && payload.size >= 0 ? payload.size : opts.file.size,
    uploadedAt: typeof payload.uploadedAt === 'string' ? payload.uploadedAt : now(),
  };
}

export async function removePortalAttachment(
  token: string,
  attachmentId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const response = await fetchImpl(`/api/portal/${encodeURIComponent(token)}/uploads/remove`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ attachmentId }),
    });
    if (response.ok) return { ok: true };
    const payload = await readJson(response);
    return { ok: false, message: messageFrom(payload, response.status) };
  } catch {
    return { ok: false, message: "Couldn't remove this file from your booking. Please try again." };
  }
}

function errorKind(status: number, payload: Payload | null): 'too_large' | 'error' {
  if (status === 413 || payload?.error === 'too_large') return 'too_large';
  return 'error';
}

function messageFrom(payload: Payload | null, status: number): string {
  if (payload && typeof payload.message === 'string' && payload.message.trim()) return payload.message.trim();
  if (status === 413 || payload?.error === 'too_large') {
    return "This file is over 5 MB, so it can't be stored on your booking. Please email or text it to Stomp Sphere. We've noted the file name and size.";
  }
  return UPLOAD_FAILED_MESSAGE;
}

interface Payload {
  error?: unknown;
  message?: unknown;
  attachmentId?: unknown;
  name?: unknown;
  type?: unknown;
  size?: unknown;
  uploadedAt?: unknown;
}

async function readJson(response: Response): Promise<Payload | null> {
  try {
    const body = (await response.json()) as unknown;
    if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
    return body as Payload;
  } catch {
    return null;
  }
}
