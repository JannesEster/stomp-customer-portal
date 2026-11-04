import { fileStatusLabel } from '../lib/portalFiles';
import type { StoredFile } from '../types';

/** Uploading, Saved, or Error with Retry. Nothing is left as a silent failure. */
export function FileStateLine({
  file,
  serverSync,
  onRetry,
}: {
  file: StoredFile;
  serverSync: boolean;
  onRetry?: () => void;
}) {
  const status = fileStatusLabel(file, serverSync);
  if (!status) return null;
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
    </p>
  );
}
