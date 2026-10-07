import { useRef, useState } from 'react';
import { findScreenStyle, portalConfig, screenStylesConfig, timingLabel, type ScreenStyleDef } from '../config';
import { acceptAttr, mediaFor, mediaKindOf, timingFor, validateUpload } from '../lib/design';
import { formatFileSize } from '../lib/format';
import { useFileUrl } from '../hooks/useFileUrl';
import { useServices } from '../services';
import type { UpdateDesign } from '../hooks/useDesignState';
import type { DesignState, MediaItem, Phase, ScreenMode } from '../types';
import { OptionList, type OptionDef } from './common';

export const SCREEN_KIND_LABELS: Record<ScreenStyleDef['kind'], string> = {
  welcome: 'Welcome sign',
  schedule: 'Order of the day',
};

const PART_NAMES: Record<Phase, string> = {
  holding: 'before the entrance',
  after: 'after the entrance',
  dancing: 'during the dancing',
};

/** Welcome signs come first, then the order of the day boards, each group in config order. */
const GALLERY = [...screenStylesConfig.styles].sort(
  (a, b) => Number(a.kind === 'schedule') - Number(b.kind === 'schedule'),
);

export function ScreenDesignStep({ design, update }: { design: DesignState; update: UpdateDesign }) {
  const { widthPx, heightPx } = portalConfig.screen;
  const chosen = findScreenStyle(design.screens.styleId);
  const select = (id: string) => update((d) => ({ ...d, screens: { ...d.screens, styleId: id } }));

  return (
    <>
      <fieldset>
        <legend>Screen design</legend>
        <div className="screen-style-grid" role="radiogroup" aria-label="Screen design">
          {GALLERY.map((s) => {
            const active = s.id === chosen?.id;
            return (
              <label
                key={s.id}
                className={active ? 'style-card screen-style-card active' : 'style-card screen-style-card'}
                title={s.description}
              >
                <input
                  type="radio"
                  name="screen-style"
                  className="sr-only"
                  checked={active}
                  onChange={() => select(s.id)}
                />
                <span className="style-thumb" style={{ aspectRatio: `${widthPx} / ${heightPx}` }}>
                  <img src={s.image} alt="" loading="lazy" />
                </span>
                <span className="style-name">{s.name}</span>
                <span className="style-tag">{SCREEN_KIND_LABELS[s.kind]}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      {chosen?.kind === 'schedule' && (
        <p className="note">
          Stomp will need your wedding party or running order for this one. Add it in the Notes/Details tab.
        </p>
      )}
    </>
  );
}

export function ScreenPartStep({
  design,
  update,
  phase,
  onPickDesign,
}: {
  design: DesignState;
  update: UpdateDesign;
  phase: Phase;
  onPickDesign: () => void;
}) {
  const style = findScreenStyle(design.screens.styleId);
  const mode = design.screens.modes[phase];
  const options: OptionDef<ScreenMode>[] = [
    {
      id: 'design',
      label: 'Your screen design',
      hint: style
        ? `${style.name}, finished by Stomp with your names and date.`
        : 'The design you pick for your screens, finished by Stomp with your names and date.',
      recommended: phase === 'holding',
    },
    { id: 'photos', label: 'Your photos and videos', hint: 'Your own photos and videos take turns on the screens.' },
  ];
  const setMode = (m: ScreenMode) =>
    update((d) => ({ ...d, screens: { ...d.screens, modes: { ...d.screens.modes, [phase]: m } } }));

  return (
    <>
      <OptionList
        name={`screens-${phase}`}
        label={timingLabel(timingFor(phase))}
        options={options}
        value={mode}
        onChange={setMode}
      />
      {mode === 'design' && !style && (
        <p className="note">
          You haven't picked a screen design yet.{' '}
          <button type="button" className="link" onClick={onPickDesign}>
            Choose one now
          </button>
        </p>
      )}
      {mode === 'photos' && <PartMedia design={design} update={update} phase={phase} />}
    </>
  );
}

function PartMedia({ design, update, phase }: { design: DesignState; update: UpdateDesign; phase: Phase }) {
  const { storage } = useServices();
  const rule = portalConfig.uploads.media;
  const timing = timingFor(phase);
  const items = mediaFor(design, phase);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    const errs: string[] = [];
    const added: MediaItem[] = [];
    try {
      for (const f of Array.from(files)) {
        const err = validateUpload(f, rule);
        const kind = mediaKindOf(f.type);
        if (err || !kind) {
          errs.push(err ?? `${f.name} isn't a supported file type.`);
          continue;
        }
        const stored = await storage.saveFile(f);
        added.push({ id: crypto.randomUUID(), file: stored, kind, timing, addedAt: new Date().toISOString() });
      }
    } finally {
      setErrors(errs);
      setBusy(false);
      if (added.length) update((d) => ({ ...d, media: [...d.media, ...added] }));
    }
  };

  const remove = (item: MediaItem) => {
    void storage.deleteFile(item.file.id);
    update((d) => ({ ...d, media: d.media.filter((m) => m.id !== item.id) }));
  };

  return (
    <div className="uploader">
      <h3>Photos and videos {PART_NAMES[phase]}</h3>
      <p className="muted small">
        They take turns on your screens in the order you add them. Photos up to {rule.maxImageMb} MB, videos up to{' '}
        {rule.maxVideoMb} MB.
      </p>
      <button type="button" className="secondary" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? 'Uploading…' : 'Add photos and videos'}
      </button>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        accept={acceptAttr(rule)}
        onChange={(e) => {
          void onFiles(e.target.files);
          e.target.value = '';
        }}
      />
      {errors.map((e) => (
        <p key={e} className="error">
          {e}
        </p>
      ))}
      {items.length === 0 ? (
        <p className="note">
          You haven't added any photos or videos for this part of the night yet. Add a few and they'll take turns on
          your screens.
        </p>
      ) : (
        <ul className="media-list">
          {items.map((m) => (
            <MediaRow key={m.id} item={m} onRemove={() => remove(m)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function MediaRow({ item, onRemove }: { item: MediaItem; onRemove: () => void }) {
  const url = useFileUrl(item.file);
  return (
    <li className="media-row">
      <div className="media-thumb">
        {url && (item.kind === 'video' ? <video src={url} muted playsInline preload="metadata" /> : <img src={url} alt="" />)}
        {item.kind === 'video' && <span className="badge">Video</span>}
      </div>
      <div className="media-info">
        <span className="media-name" title={item.file.name}>
          {item.file.name}
        </span>
        <span className="muted small">{formatFileSize(item.file.size)}</span>
      </div>
      <button type="button" className="link" onClick={onRemove} aria-label={`Remove ${item.file.name}`}>
        Remove
      </button>
    </li>
  );
}
