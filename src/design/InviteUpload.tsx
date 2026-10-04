import { useRef, useState } from 'react';
import { portalConfig } from '../config';
import { acceptAttr, validateUpload } from '../lib/design';
import { formatFileSize } from '../lib/format';
import type { InviteAnalysis } from '../lib/invite';
import {
  INVITE_STYLE_ID,
  LAYOUT_LABELS,
  TYPOGRAPHY_LABELS,
  basedOnKey,
  generateInviteStyle,
  inviteInputs,
} from '../lib/inviteStyle';
import { useFileUrl } from '../hooks/useFileUrl';
import { useServices } from '../services';
import type { UpdateDesign } from '../hooks/useDesignState';
import type { DesignState } from '../types';
import { fileStillUsed } from './common';
import { GeneratedThumb } from './GeneratedThumb';

export function InviteUpload({
  design,
  update,
  eventDate,
}: {
  design: DesignState;
  update: UpdateDesign;
  eventDate: string;
}) {
  const { storage } = useServices();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const invite = design.invite;
  const thumbUrl = useFileUrl(design.invitePreview ?? (invite?.type.startsWith('image/') ? invite : null));

  const releaseFiles = () => {
    for (const f of [design.invite, design.invitePreview]) {
      if (f && !fileStillUsed(design, f.id, 'invite')) void storage.deleteFile(f.id);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const err = validateUpload(file, portalConfig.uploads.invite);
    setError(err);
    if (err) return;
    setBusy(true);
    try {
      const stored = await storage.saveFile(file);
      let analysis: InviteAnalysis = { palette: null, namesColour: null, preview: null };
      try {
        // Loaded on demand so PDF.js stays out of the first page load on phones.
        const { analyseInvite } = await import('../lib/invite');
        analysis = await analyseInvite(file);
      } catch {
        // An invite we can't read still goes to Stomp, just without colours or a thumbnail.
      }
      const preview = analysis.preview
        ? await storage.saveFile(new File([analysis.preview], `${file.name}.png`, { type: 'image/png' }))
        : null;
      releaseFiles();
      update((d) => ({
        ...d,
        invite: stored,
        invitePreview: preview,
        invitePalette: analysis.palette?.colours ?? [],
        inviteNamesColour: analysis.namesColour,
        invitePaper: analysis.palette?.background ?? null,
      }));
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    releaseFiles();
    update((d) => ({
      ...d,
      invite: null,
      invitePreview: null,
      invitePalette: [],
      inviteNamesColour: null,
      invitePaper: null,
    }));
  };

  /** The first press gives the best match; pressing again steps through other versions until the invite or note changes. */
  const generate = () =>
    update((d) => {
      const inputs = inviteInputs(d);
      const prev = d.inviteStyle;
      const variant = prev && prev.basedOn === basedOnKey(inputs) ? prev.variant + 1 : 0;
      return {
        ...d,
        inviteStyle: generateInviteStyle(inputs, variant),
        designs: { ...d.designs, holding: { ...d.designs.holding, styleId: INVITE_STYLE_ID } },
      };
    });

  const generated = design.inviteStyle;
  const upToDate = generated?.basedOn === basedOnKey(inviteInputs(design));

  return (
    <aside className="invite">
      <h3>Invite or styling</h3>
      <p className="muted small">
        Upload your wedding invite or a styling document. We'll pick up its colours for your names, and it helps Stomp
        match the font and styling on and around your holding screen.
      </p>

      <div className="invite-thumb">
        {busy ? (
          <span className="muted small">Reading your invite…</span>
        ) : invite && thumbUrl ? (
          <img src={thumbUrl} alt="Your invite or styling reference" />
        ) : invite ? (
          <div className="pdf-fallback">{invite.name}</div>
        ) : (
          <span className="muted small">No file yet</span>
        )}
      </div>
      {invite && (
        <p className="muted small">
          {invite.name}, {formatFileSize(invite.size)}
        </p>
      )}

      {design.inviteNamesColour && (
        <div className="palette">
          <div className="palette-row">
            <span className="palette-title">Your names on the floor</span>
            <span className="swatch names" style={{ background: design.inviteNamesColour }} title={design.inviteNamesColour}>
              <span className="sr-only">{design.inviteNamesColour}</span>
            </span>
          </div>
          {design.invitePalette.length > 0 && (
            <div className="palette-row">
              <span className="palette-title">Colours from your invite</span>
              <span className="swatches">
                {design.invitePalette.map((c) => (
                  <span key={c} className="swatch" style={{ background: c }} title={c}>
                    <span className="sr-only">{c}</span>
                  </span>
                ))}
              </span>
            </div>
          )}
          <p className="muted small">
            The floor is dark, so your names use the brightest invite colour that will stand out on it.
          </p>
        </div>
      )}

      {invite && !busy && (
        <div className="generate">
          <button type="button" className="cta" onClick={generate}>
            {generated && upToDate ? 'Try another version' : 'Generate a design from my invite'}
          </button>
          <p className="muted small">
            Uses your invite's colours and your styling note. The floor always stays dark, because big areas of white
            look harsh on an LED floor.
          </p>
          {generated && (
            <div className="generated-result">
              <GeneratedThumb
                style={generated}
                names={design.designs.holding.names}
                eventDate={eventDate}
                className="generated-thumb"
              />
              <p className="muted small">
                {TYPOGRAPHY_LABELS[generated.typography]}, {LAYOUT_LABELS[generated.layout]}.
                {generated.noteCues.length > 0 && ` From your note: ${generated.noteCues.join(', ')}.`}
                {!upToDate && ' Your invite or note has changed since, so generate again to use it.'}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="row">
        <button type="button" className="secondary" disabled={busy} onClick={() => input.current?.click()}>
          {invite ? 'Replace file' : 'Upload PDF or image'}
        </button>
        {invite && !busy && (
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
