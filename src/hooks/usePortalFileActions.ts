import { useCallback } from 'react';
import { fileMime, outcomeToPatch, type UploadOutcome, type UploadRole } from '../lib/portalFiles';
import { removePortalAttachment, uploadPortalFile } from '../services/uploadClient';
import { useServices } from '../services';
import type { StoredFile } from '../types';

/** Save a copy on this device, then send it to the booking when this is a portal link. */
export function usePortalFileActions() {
  const { storage, portal } = useServices();
  const token = portal?.token ?? null;

  const send = useCallback(
    async (file: File, role: UploadRole, onPending?: (file: StoredFile) => void): Promise<StoredFile> => {
      const meta = await storage.saveFile(file);
      const type = fileMime(file);
      const pending: StoredFile = {
        ...meta,
        type: type || meta.type,
        uploadState: token ? 'uploading' : 'local',
        uploadError: null,
      };
      onPending?.(pending);
      if (!token) return { ...pending, uploadState: 'local' };
      const outcome = await uploadPortalFile({ token, file, filename: file.name, type, role });
      return applyOutcome(pending, outcome);
    },
    [storage, token],
  );

  const retry = useCallback(
    async (file: StoredFile, role: UploadRole): Promise<Partial<StoredFile>> => {
      if (!token) return { uploadState: 'local', uploadError: null };
      const blob = await storage.getFile(file.id);
      if (!blob) {
        return { uploadState: 'error', uploadError: 'This file is no longer on this device. Please choose it again.' };
      }
      const outcome = await uploadPortalFile({
        token,
        file: blob,
        filename: file.name,
        type: file.type || blob.type,
        role,
      });
      return outcomeToPatch(outcome) ?? { uploadState: 'error', uploadError: "Couldn't upload this file. Please try again." };
    },
    [storage, token],
  );

  const removeStored = useCallback(
    async (file: StoredFile): Promise<{ ok: true } | { ok: false; message: string }> => {
      if (token && file.attachmentId) {
        const removed = await removePortalAttachment(token, file.attachmentId);
        if (!removed.ok) return removed;
      }
      try {
        await storage.deleteFile(file.id);
      } catch {
        /* The booking copy is already gone. A leftover local blob can be cleaned up later. */
      }
      return { ok: true };
    },
    [storage, token],
  );

  return { send, retry, removeStored, serverSync: token !== null };
}

function applyOutcome(file: StoredFile, outcome: UploadOutcome): StoredFile {
  const patch = outcomeToPatch(outcome);
  return patch ? { ...file, ...patch } : file;
}
