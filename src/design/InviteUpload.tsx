import { useRef, useState } from 'react';
import { portalConfig } from '../config';
import { acceptAttr, validateUpload } from '../lib/design';
import { formatFileSize } from '../lib/format';
import { useFileUrl } from '../hooks/useFileUrl';
import { useServices } from '../services';
import type { UpdateDesign } from '../hooks/useDesignState';
import type { DesignState } from '../types';
import { fileStillUsed } from './common';

export function InviteUpload({ design, update }: { design: DesignState; update: UpdateDesign }) {
  const { storage } = useServices();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const url = useFileUrl(design.invite);
  const invite = design.invite;

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const err = validateUpload(file, portalConfig.uploads.invite);
    setError(err);
    if (err) return;
    const stored = await storage.saveFile(file);
    if (invite && !fileStillUsed(design, invite.id, 'invite')) void storage.deleteFile(invite.id);
    update((d) => ({ ...d, invite: stored }));
  };

  const remove = () => {
    if (invite && !fileStillUsed(design, invite.id, 'invite')) void storage.deleteFile(invite.id);
    update((d) => ({ ...d, invite: null }));
  };

  return (
    <aside className="invite">
      <h3>Invite or styling</h3>
      <p className="muted small">
        Upload your wedding invite or a styling document. It helps Stomp match the font and styling on and around your
        holding screen.
      </p>

      <div className="invite-thumb">
        {invite && url ? (
          invite.type === 'application/pdf' ? (
            <object data={url} type="application/pdf" aria-label={invite.name}>
              <div className="pdf-fallback">PDF: {invite.name}</div>
            </object>
          ) : (
            <img src={url} alt="Your invite or styling reference" />
          )
        ) : (
          <span className="muted small">No file yet</span>
        )}
      </div>
      {invite && (
        <p className="muted small">
          {invite.name}, {formatFileSize(invite.size)}
        </p>
      )}

      <div className="row">
        <button type="button" className="secondary" onClick={() => input.current?.click()}>
          {invite ? 'Replace file' : 'Upload PDF or image'}
        </button>
        {invite && (
          <button type="button" className="link" onClick={remove}>
            Remove
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        hidden
        accept={acceptAttr(portalConfig.uploads.invite)}
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {error && <p className="error">{error}</p>}

      <label className="field">
        <span>Styling note (optional)</span>
        <textarea
          rows={3}
          value={design.stylingNote}
          placeholder="Colours, flowers, theme, anything that helps"
          onChange={(e) => update((d) => ({ ...d, stylingNote: e.target.value }))}
        />
      </label>
    </aside>
  );
}
