import { useRef, useState } from 'react';
import { findStyle, holdingStylesConfig, portalConfig, type HoldingStyleDef } from '../config';
import { acceptAttr, mediaKindOf, validateUpload } from '../lib/design';
import { useFileUrl } from '../hooks/useFileUrl';
import { useServices } from '../services';
import type { UpdateDesign } from '../hooks/useDesignState';
import { generatedFor, INVITE_STYLE_ID, LAYOUT_LABELS, TYPOGRAPHY_LABELS } from '../lib/inviteStyle';
import type { DesignState, HoldingDesign, Phase } from '../types';
import { fileStillUsed } from './common';
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
  const { storage } = useServices();
  const h = design.designs[phase];
  const style = findStyle(h.styleId);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const mediaUrl = useFileUrl(h.media);
  const rule = portalConfig.uploads.holdingMedia;
  const set = setterFor(update, phase);

  const release = () => {
    if (h.media && !fileStillUsed(design, h.media.id, phase)) void storage.deleteFile(h.media.id);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const error = validateUpload(file, rule);
    setMediaError(error);
    if (error) return;
    const stored = await storage.saveFile(file);
    release();
    set({ media: stored });
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
      <div className="row">
        <button type="button" className="secondary" onClick={() => input.current?.click()}>
          {h.media ? 'Replace' : 'Upload photo or video'}
        </button>
        {h.media && (
          <button
            type="button"
            className="link"
            onClick={() => {
              release();
              set({ media: null });
            }}
          >
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
        Photos up to {rule.maxImageMb} MB, videos up to {rule.maxVideoMb} MB.
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
