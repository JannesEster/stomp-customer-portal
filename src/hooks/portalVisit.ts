import { floorPreviewHash } from './floorPreviewSync';
import {
  mergePortalAnswers,
  runPortalFileMigration,
  withFilePatch,
  type MigrationUpload,
  type UploadOutcome,
} from '../lib/portalFiles';
import type { DesignState } from '../types';

/**
 * What happens when a portal page loads, including a second loader on the Notes tab.
 * Nothing is posted. Name-only files are left as they were saved.
 */
export async function openPortalOnDevice(opts: {
  design: DesignState;
  /** False on the seeded demo, and whenever this browser must not send files. */
  migrate: boolean;
  readBlob: (fileId: string) => Promise<Blob | null>;
  upload: (input: MigrationUpload) => Promise<UploadOutcome>;
}): Promise<{ design: DesignState; previewHash: string; dirty: false }> {
  let design = opts.design;
  if (!opts.migrate) return { design, previewHash: floorPreviewHash(design), dirty: false };
  await runPortalFileMigration({
    design: opts.design,
    readBlob: opts.readBlob,
    upload: opts.upload,
    onPatch: (fileId, patch) => {
      design = withFilePatch(design, fileId, patch);
    },
  });
  return { design, previewHash: floorPreviewHash(design), dirty: false };
}

/** A floor preview is sent only after the couple edits the picture, or when they submit or retry. */
export function shouldSendFloorPreview(opts: {
  userEdited: boolean;
  explicit: boolean;
  previousHash: string | null;
  nextHash: string;
}): boolean {
  if (opts.explicit) return true;
  if (!opts.userEdited) return false;
  return opts.previousHash !== opts.nextHash;
}

/** One field change, then merge so invite, colours, and name-only files stay. */
export function commitUserEdit(
  current: DesignState,
  server: DesignState | null,
  change: (design: DesignState) => DesignState,
  now = new Date().toISOString(),
): DesignState {
  const edited = { ...change(current), status: 'draft' as const, updatedAt: now };
  return mergePortalAnswers(edited, server);
}
