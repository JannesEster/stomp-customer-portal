import { useRef, useState } from 'react';
import { findStyle, holdingStylesConfig, portalConfig, type HoldingStyleDef } from '../config';
import { acceptAttr, mediaKindOf, validateUpload } from '../lib/design';
import { replaceSingleSlot, roleForPhase, withFilePatch } from '../lib/portalFiles';
import { useFileUrl } from '../hooks/useFileUrl';
import { usePortalFileActions } from '../hooks/usePortalFileActions';
import type { UpdateDesign } from '../hooks/useDesignState';
import { generatedFor, INVITE_STYLE_ID, LAYOUT_LABELS, TYPOGRAPHY_LABELS } from '../lib/inviteStyle';
import type { DesignState, HoldingDesign, Phase, StoredFile } from '../types';
import { fileStillUsed } from './common';
import { FileStateLine } from './FileState';
import { GeneratedThumb } from './GeneratedThumb';

interface PartProps {
  design: DesignState;
  update: UpdateDesign;
  phase: Phase;
}

/** Styles without the couple's photo come first, each group in config order. */
const GALLERY = [...holdingStylesConfig.styles].sort((a, b) => Number(a.usesPhoto) - Number(b.usesPhoto));

function setterFor(update: UpdateDesign, phase: Phase) {
  return (patch: Partial<HoldingDesign>) =>
    update((d) => ({ ...d, designs: { ...d.designs, [phase]: { ...d.designs[phase], ...patch } } }));
}

/** Style, names and couple photo or video for one phase's design, in one column. */
export function HoldingFields({ design, update, phase, eventDate }: PartProps & { eventDate: string }) {
  return (
    <div className="builder">
      <StylePicker design={design} update={update} phase={phase} eventDate={eventDate} />
      <NamesField design={design} update={update} phase={phase} />
      <CouplePhoto design={design} update={update} phase={phase} />
    </div>
  );
}

export function StylePicker({ design, update, phase, eventDate }: PartProps & { eventDate: string }) {
  const h = design.designs[phase];
  const usingInvite = h.styleId === INVITE_STYLE_ID && !!design.inviteStyle;
  const set = setterFor(update, phase);
  return (
    <fieldset>
      <legend>Style</legend>
      <div className="style-grid" role="radiogroup" aria-label="Style">
        {design.inviteStyle && (
          <button
            type="button"
            role="radio"
            aria-checked={usingInvite}
            className={usingInvite ? 'style-card active' : 'style-card'}
            onClick={() => set({ styleId: INVITE_STYLE_ID })}
          >
            <span className="style-thumb">
              <GeneratedThumb style={design.inviteStyle} names={h.names} eventDate={eventDate} />
            </span>
            <span className="style-name">From your invite</span>
            <span className="style-tag">
              {TYPOGRAPHY_LABELS[design.inviteStyle.typography]}, {LAYOUT_LABELS[design.inviteStyle.layout]}
            </span>
          </button>
        )}
        {GALLERY.map((s) => (
          <StyleCard key={s.id} style={s} active={h.styleId === s.id} onSelect={() => set({ styleId: s.id })} />
        ))}
      </div>
    </fieldset>
  );
}

export function NamesField({ design, update, phase }: PartProps) {
  const h = design.designs[phase];
  const showsDate = findStyle(h.styleId)?.live.date || !!generatedFor(design, h.styleId);
  const set = setterFor(update, phase);
  return (
    <div className="names-field">
      <label className="field">
        <span>Your names, as you'd like them shown</span>
        <input
          type="text"
          value={h.names}
          placeholder="For example, Sam & Alex"
          onChange={(e) => set({ names: e.target.value })}
        />
      </label>
      {showsDate && <p className="muted small">This style shows your wedding date, taken from your booking.</p>}
    </div>
  );
}

export function CouplePhoto({ design, update, phase }: PartProps) {
  const { send, retry, removeStored, discardUnsaved, serverSync } = usePortalFileActions();
  const h = design.designs[phase];
  const style = findStyle(h.styleId);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [pending, setPending] = useState<StoredFile | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const mediaUrl = useFileUrl(h.media);
  const rule = portalConfig.uploads.holdingMedia;
  const set = setterFor(update, phase);
  const role = roleForPhase(phase);

  const applyAttempt = async (kept: StoredFile | null, attempt: StoredFile) => {
    const decision = replaceSingleSlot(kept, attempt);
    setPending(decision.pending);
    if (decision.pending) return;
    if (decision.slot) set({ media: decision.slot });
    setMediaError(null);
    if (decision.remove && !fileStillUsed(design, decision.remove.id, phase)) {
      const removed = await removeStored(decision.remove);
      if (!removed.ok) setMediaError(removed.message);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const error = validateUpload(file, rule);
    setMediaError(error);
    if (error) return;
    if (pending && !pending.attachmentId) void discardUnsaved(pending);
    const kept = h.media;
    const stored = await send(file, role, (next) => {
      const decision = replaceSingleSlot(kept, next);
      setPending(decision.pending);
      if (!decision.pending && decision.slot) set({ media: decision.slot });
    });
    await applyAttempt(kept, stored);
  };

  const onRemove = async () => {
    if (pending) {
      void discardUnsaved(pending);
      setPending(null);
    }
    if (!h.media) return;
    const removed = await removeStored(h.media);
    if (!removed.ok) {
      setMediaError(removed.message);
      return;
    }
    setMediaError(null);
    set({ media: null });
  };

  const onRetry = () => {
    if (!h.media) return;
    const id = h.media.id;
    update((d) => withFilePatch(d, id, { uploadState: 'uploading', uploadError: null }));
    void retry(h.media, role).then((patch) => {
      update((d) => withFilePatch(d, id, patch));
    });
  };

  const onRetryPending = () => {
    if (!pending) return;
    const kept = h.media;
    const id = pending.id;
    setPending({ ...pending, uploadState: 'uploading', uploadError: null });
    void retry(pending, role).then((patch) => {
      void applyAttempt(kept, { ...pending, ...patch, id });
    });
  };

  const onCancelPending = () => {
    if (!pending) return;
    void discardUnsaved(pending);
    setPending(null);
    setMediaError(null);
  };

  return (
    <fieldset>
      <legend>Photo or video of the two of you</legend>
      <p className="muted small">
        {style?.usesPhoto
          ? `${style.name} uses a photo or video of the two of you as the background. A close up of your hands with the rings works well too.`
          : 'Optional. Styles marked "Uses your photo" put it in the background.'}
      </p>
      {h.media &&
        mediaUrl &&
        (mediaKindOf(h.media.type) === 'video' ? (
          <video className="thumb" src={mediaUrl} muted loop autoPlay playsInline aria-label="Your video" />
        ) : (
          <img className="thumb" src={mediaUrl} alt="Your photo" />
        ))}
      {h.media && !mediaUrl && <p className="muted small">{h.media.name}</p>}
      {h.media && <FileStateLine file={h.media} serverSync={serverSync} onRetry={onRetry} />}
      {pending && (
        <FileStateLine file={pending} serverSync={serverSync} onRetry={onRetryPending} onCancel={onCancelPending} />
      )}
      <div className="row">
        <button type="button" className="secondary" onClick={() => input.current?.click()}>
          {h.media ? 'Replace' : 'Upload photo or video'}
        </button>
        {h.media && (
          <button type="button" className="link" onClick={() => void onRemove()}>
            Remove
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        hidden
        accept={acceptAttr(rule)}
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <p className="muted small">
        Photos up to {rule.maxImageMb} MB. Larger photos are reduced to fit. Videos over 5 MB can't be stored on your
        booking, so email or text those to Stomp Sphere.
      </p>
      {mediaError && <p className="error">{mediaError}</p>}
    </fieldset>
  );
}

/** Shows the poster, and only loads the video while hovered or selected. */
function StyleCard({ style, active, onSelect }: { style: HoldingStyleDef; active: boolean; onSelect: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      className={active ? 'style-card active' : 'style-card'}
      onClick={onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={style.description}
    >
      <span className="style-thumb">
        {active || hover ? (
          <video src={style.sampleVideo} poster={style.poster} autoPlay muted loop playsInline aria-hidden />
        ) : (
          <img src={style.poster} alt="" loading="lazy" />
        )}
      </span>
      <span className="style-name">{style.name}</span>
      {style.usesPhoto && <span className="style-tag">Uses your photo</span>}
    </button>
  );
}
