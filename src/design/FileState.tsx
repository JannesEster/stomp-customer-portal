import { useEffect, useState } from 'react';
import { fileStatusLabel, isNameOnlyFile, OTHER_DEVICE_FILE_NOTE } from '../lib/portalFiles';
import { useServices } from '../services';
import type { StoredFile } from '../types';

/** Name-only file, with no copy in this browser. Not an error and not saved into the answers. */
export function useOtherDeviceNote(file: StoredFile | null | undefined): string | null {
  const { storage } = useServices();
  const [missing, setMissing] = useState(false);
  const id = file?.id ?? null;
  const hasAttachment = !!file?.attachmentId;

  useEffect(() => {
    let cancelled = false;
    if (!id || hasAttachment) {
      setMissing(false);
      return;
    }
    void storage
      .getFile(id)
      .then((blob) => {
        if (!cancelled) setMissing(!blob);
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id, hasAttachment, storage]);

  if (!file || hasAttachment) return null;
  if (isNameOnlyFile(file)) return OTHER_DEVICE_FILE_NOTE;
  return missing ? OTHER_DEVICE_FILE_NOTE : null;
}

export function OtherDeviceFileNote({ file }: { file: StoredFile | null | undefined }) {
  const note = useOtherDeviceNote(file);
  if (!note) return null;
  return <p className="muted small file-state">{note}</p>;
}

/** Saved state, or a soft note when the file lives on another device. */
export function FilePresence({
  file,
  serverSync,
  onRetry,
  onCancel,
}: {
  file: StoredFile | null | undefined;
  serverSync: boolean;
  onRetry?: () => void;
  onCancel?: () => void;
}) {
  const away = useOtherDeviceNote(file);
  if (!file) return null;
  if (away) return <p className="muted small file-state">{away}</p>;
  return <FileStateLine file={file} serverSync={serverSync} onRetry={onRetry} onCancel={onCancel} />;
}

/** Uploading, Saved, or Error with Retry. Nothing is left as a silent failure. */
export function FileStateLine({
  file,
  serverSync,
  onRetry,
  onCancel,
}: {
  file: StoredFile;
  serverSync: boolean;
  onRetry?: () => void;
  onCancel?: () => void;
}) {
  const status = fileStatusLabel(file, serverSync);
  if (!status) return null;
  const canCancel = !!onCancel && file.uploadState !== 'uploading' && file.uploadState !== 'saved';
  return (
    <p className={status.tone === 'error' ? 'error file-state' : 'muted small file-state'} aria-live="polite">
      {status.text}
      {status.retry && onRetry && (
        <>
          {' '}
          <button type="button" className="link" onClick={onRetry}>
            Retry
          </button>
        </>
      )}
      {canCancel && (
        <>
          {' '}
          <button type="button" className="link" onClick={onCancel}>
            Cancel
          </button>
        </>
      )}
    </p>
  );
}
