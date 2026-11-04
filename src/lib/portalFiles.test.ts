import { describe, expect, it } from 'vitest';
import { createDefaultDesign } from './design';
import {
  MISSING_DEVICE_MESSAGE,
  TOO_LARGE_MESSAGE,
  UPLOAD_FAILED_MESSAGE,
  UPLOAD_LABELS,
  attachmentFilename,
  blocksBeforeUpload,
  fileNeedsUpload,
  fileStatusLabel,
  formatPerth,
  migrationCandidates,
  outcomeToPatch,
  portalUploadsList,
  preserveStoredFiles,
  replaceSingleSlot,
  runPortalFileMigration,
  withFilePatch,
} from './portalFiles';
import type { DesignState, StoredFile } from '../types';

const ATTACHMENT = 'attABCDEFGHIJKLMN';

function design(): DesignState {
  const next = createDefaultDesign({ coupleNames: 'Sam and Alex' }, new Date('2026-04-01T00:00:00.000Z'));
  next.entranceTime = '16:40';
  next.dancingStarts = '19:00';
  next.designs.holding.names = 'Sam and Alex';
  next.designs.holding.media = {
    id: 'file-hands',
    name: 'hands.heic',
    type: 'image/heic',
    size: 4_000_000,
  };
  next.media = [
    {
      id: 'item-1',
      file: { id: 'file-clip', name: 'dance.mp4', type: 'video/mp4', size: 80_000_000 },
      kind: 'video',
      timing: 'start',
      addedAt: '2026-11-01T00:00:00.000Z',
    },
  ];
  return next;
}

describe('portal file labels', () => {
  it('names attachments with the purpose and the file, without a spaced hyphen', () => {
    expect(attachmentFilename(UPLOAD_LABELS['holding-pre'], 'photo.jpg')).toBe(
      'Holding screen pre-bridal (photo.jpg)',
    );
    expect(attachmentFilename(UPLOAD_LABELS['holding-pre'], 'my - photo.jpg')).toBe(
      'Holding screen pre-bridal (my photo.jpg)',
    );
    expect(attachmentFilename(UPLOAD_LABELS['media-start'], '../dance.mp4')).toBe('Media start of night (dance.mp4)');
    for (const label of Object.values(UPLOAD_LABELS)) {
      expect(label).not.toMatch(/ - /);
      expect(label).not.toMatch(/[—–]/);
    }
  });

  it('writes one labelled line per file in Perth time', () => {
    const next = design();
    next.designs.holding.media = {
      ...(next.designs.holding.media as StoredFile),
      name: 'photo.jpg',
      type: 'image/jpeg',
      size: 1_200_000,
      attachmentId: ATTACHMENT,
      uploadState: 'saved',
      uploadedAt: '2026-11-04T01:30:00.000Z',
    };
    next.media[0].file = {
      ...next.media[0].file,
      uploadState: 'too_large',
      uploadError: TOO_LARGE_MESSAGE,
      uploadedAt: '2026-11-04T01:30:00.000Z',
    };
    const list = portalUploadsList(next);
    expect(list).toContain('Holding screen pre-bridal, photo.jpg, image/jpeg');
    expect(list).toContain('9:30 am AWST, saved');
    expect(list).toContain('Media start of night, dance.mp4, video/mp4');
    expect(list).toContain('not uploaded (over 5 MB, please email or text Stomp Sphere)');
    expect(list).not.toMatch(/ - /);
    expect(formatPerth('2026-11-04T01:30:00.000Z')).toContain('AWST');
  });
});

describe('portal file states', () => {
  it('shows Uploading, Saved, and Error with Retry', () => {
    const file: StoredFile = { id: 'f', name: 'a.jpg', type: 'image/jpeg', size: 10 };
    expect(fileStatusLabel({ ...file, uploadState: 'uploading' }, true)).toMatchObject({ text: 'Uploading…', retry: false });
    expect(fileStatusLabel({ ...file, uploadState: 'saved', attachmentId: ATTACHMENT }, true)).toMatchObject({
      text: 'Saved',
      retry: false,
    });
    expect(fileStatusLabel({ ...file, uploadState: 'error', uploadError: 'Try again.' }, true)).toMatchObject({
      text: 'Try again.',
      retry: true,
    });
    expect(fileStatusLabel({ ...file, uploadState: 'too_large', uploadError: TOO_LARGE_MESSAGE }, true)?.retry).toBe(
      false,
    );
    expect(fileStatusLabel(file, false)?.text).toBe('Saved on this device');
  });

  it('does not send a video that is already over 5 MB', () => {
    expect(blocksBeforeUpload({ type: 'video/mp4', size: 6 * 1024 * 1024 })).toBe(TOO_LARGE_MESSAGE);
    expect(blocksBeforeUpload({ type: 'image/jpeg', size: 18 * 1024 * 1024 })).toBeNull();
    expect(blocksBeforeUpload({ type: 'video/mp4', size: 1024 })).toBeNull();
  });
});

describe('answer preservation', () => {
  it('patches a file without touching names or times', () => {
    const next = withFilePatch(design(), 'file-hands', {
      attachmentId: ATTACHMENT,
      uploadState: 'saved',
      type: 'image/jpeg',
      name: 'hands.jpg',
    });
    expect(next.entranceTime).toBe('16:40');
    expect(next.dancingStarts).toBe('19:00');
    expect(next.designs.holding.names).toBe('Sam and Alex');
    expect(next.designs.holding.media?.attachmentId).toBe(ATTACHMENT);
    expect(next.designs.holding.media?.name).toBe('hands.jpg');
    expect(next.media[0].file.id).toBe('file-clip');
  });

  it('keeps an attachment id when a later save forgets it', () => {
    const stored = design();
    stored.designs.holding.media = {
      ...(stored.designs.holding.media as StoredFile),
      attachmentId: ATTACHMENT,
      uploadState: 'saved',
      name: 'hands.jpg',
      type: 'image/jpeg',
      size: 80_000,
    };
    const posted = design();
    posted.designs.holding.names = 'Sam and Alex updated';
    posted.entranceTime = '17:00';
    const merged = preserveStoredFiles(posted, stored);
    expect(merged.designs.holding.names).toBe('Sam and Alex updated');
    expect(merged.entranceTime).toBe('17:00');
    expect(merged.designs.holding.media?.attachmentId).toBe(ATTACHMENT);
    expect(merged.designs.holding.media?.uploadState).toBe('saved');
    expect(merged.designs.holding.media?.name).toBe('hands.jpg');
  });
});

describe('replacing a single saved file', () => {
  const saved: StoredFile = {
    id: 'file-hands',
    name: 'hands.jpg',
    type: 'image/jpeg',
    size: 80_000,
    attachmentId: ATTACHMENT,
    uploadState: 'saved',
    uploadedAt: '2026-11-04T01:30:00.000Z',
  };

  it('swaps the slot and drops the previous attachment only after the replacement has saved', () => {
    const next: StoredFile = {
      id: 'file-new',
      name: 'rings.jpg',
      type: 'image/jpeg',
      size: 90_000,
      attachmentId: 'attNEWRINGS000001',
      uploadState: 'saved',
      uploadedAt: '2026-11-04T02:00:00.000Z',
    };
    const decision = replaceSingleSlot(saved, next);
    expect(decision.slot).toBe(next);
    expect(decision.pending).toBeNull();
    expect(decision.remove).toBe(saved);
    expect(decision.remove?.attachmentId).toBe(ATTACHMENT);
  });

  it('keeps the saved photo when the replacement is over 5 MB', () => {
    const rejected: StoredFile = {
      id: 'file-clip',
      name: 'dance.mp4',
      type: 'video/mp4',
      size: 80_000_000,
      uploadState: 'too_large',
      uploadError: TOO_LARGE_MESSAGE,
      attachmentId: null,
    };
    const decision = replaceSingleSlot(saved, rejected);
    expect(decision.slot).toBe(saved);
    expect(decision.slot?.attachmentId).toBe(ATTACHMENT);
    expect(decision.remove).toBeNull();
    expect(decision.pending).toBe(rejected);
    expect(decision.pending?.uploadError).toBe(TOO_LARGE_MESSAGE);
  });

  it('keeps the saved photo when the replacement fails to send', () => {
    const failed: StoredFile = {
      id: 'file-new',
      name: 'rings.jpg',
      type: 'image/jpeg',
      size: 2_000_000,
      uploadState: 'error',
      uploadError: UPLOAD_FAILED_MESSAGE,
      attachmentId: null,
    };
    const decision = replaceSingleSlot(saved, failed);
    expect(decision.slot).toBe(saved);
    expect(decision.slot?.attachmentId).toBe(ATTACHMENT);
    expect(decision.remove).toBeNull();
    expect(decision.pending?.uploadState).toBe('error');
    expect(decision.pending?.uploadError).toBe(UPLOAD_FAILED_MESSAGE);
  });

  it('does not remove the saved photo while the replacement is still uploading', () => {
    const uploading: StoredFile = {
      id: 'file-new',
      name: 'rings.jpg',
      type: 'image/jpeg',
      size: 2_000_000,
      uploadState: 'uploading',
    };
    const decision = replaceSingleSlot(saved, uploading);
    expect(decision.slot).toBe(saved);
    expect(decision.remove).toBeNull();
    expect(decision.pending?.uploadState).toBe('uploading');
  });
});

describe('IndexedDB migration', () => {
  it('uploads a local blob and leaves the rest of the draft in place', async () => {
    const patches: { id: string; patch: Partial<StoredFile> }[] = [];
    let current = design();
    await runPortalFileMigration({
      design: current,
      readBlob: async (id) => (id === 'file-hands' ? new Blob(['photo']) : null),
      upload: async () => ({
        ok: true,
        kind: 'saved',
        attachmentId: ATTACHMENT,
        name: 'hands.jpg',
        type: 'image/jpeg',
        size: 5,
        uploadedAt: '2026-11-04T01:30:00.000Z',
      }),
      onPatch: (id, patch) => {
        patches.push({ id, patch });
        current = withFilePatch(current, id, patch);
      },
    });
    expect(current.entranceTime).toBe('16:40');
    expect(current.designs.holding.names).toBe('Sam and Alex');
    expect(current.designs.holding.media?.attachmentId).toBe(ATTACHMENT);
    expect(current.designs.holding.media?.uploadState).toBe('saved');
    expect(current.media[0].file.uploadState).toBe('error');
    expect(current.media[0].file.uploadError).toBe(MISSING_DEVICE_MESSAGE);
    expect(patches.some((item) => item.patch.uploadState === 'uploading')).toBe(true);
  });

  it('skips files that are already stored or only noted as too big', () => {
    const next = design();
    next.designs.holding.media = { ...(next.designs.holding.media as StoredFile), attachmentId: ATTACHMENT };
    next.media[0].file = { ...next.media[0].file, uploadState: 'too_large' };
    expect(migrationCandidates(next)).toEqual([]);
    expect(fileNeedsUpload(next.designs.holding.media)).toBe(false);
    expect(outcomeToPatch({ ok: false, kind: 'too_large', message: TOO_LARGE_MESSAGE, notedAt: '2026-11-04T01:30:00.000Z' })?.uploadState).toBe(
      'too_large',
    );
  });
});
