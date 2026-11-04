import { fileStatusLabel } from '../lib/portalFiles';
import type { StoredFile } from '../types';

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
