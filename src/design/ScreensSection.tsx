import { useEffect, useRef, useState } from 'react';
import { portalConfig, timingLabel } from '../config';
import { screenCount } from '../lib/dimensions';
import { acceptAttr, mediaKindOf, validateUpload } from '../lib/design';
import { useFileUrl } from '../hooks/useFileUrl';
import { useServices } from '../services';
import type { UpdateDesign } from '../hooks/useDesignState';
import type { Booking, DesignState, MediaItem, Timing } from '../types';
import { Accent, Section } from './common';

type Filter = Timing | 'all';

export function ScreensSection({
  booking,
  design,
  update,
}: {
  booking: Booking;
  design: DesignState;
  update: UpdateDesign;
}) {
  const screens = screenCount(booking.screensBooked);
  const [filter, setFilter] = useState<Filter>('all');
  const items = filter === 'all' ? design.media : design.media.filter((m) => m.timing === filter);
  const slide = useSlideIndex(items.length);

  if (screens === 0) return null;

  return (
    <Section
      title={
        <>
          Screens, photos and <Accent>videos</Accent>
        </>
      }
      intro="Upload photos and videos to show on your portrait screens, and tell us when in the night to play each one."
    >
      <div className="two-col screens-layout">
        <div>
          <div className="toolbar">
            <div className="segmented" role="radiogroup" aria-label="Show media for">
              {(['all', ...portalConfig.timings.map((t) => t.id)] as Filter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  role="radio"
                  aria-checked={filter === f}
                  className={filter === f ? 'active' : ''}
                  onClick={() => setFilter(f)}
                >
                  {f === 'all' ? 'All' : timingLabel(f).replace(' of night', '')}
                </button>
              ))}
            </div>
          </div>
          <div className="screens">
            {Array.from({ length: screens }, (_, i) => (
              <ScreenPreview
                key={i}
                index={i}
                item={items.length ? items[(slide + i) % items.length] : null}
              />
            ))}
          </div>
        </div>
        <MediaUploader design={design} update={update} />
      </div>
    </Section>
  );
}

function useSlideIndex(count: number): number {
  const [i, setI] = useState(0);
  useEffect(() => {
    setI(0);
    if (count < 2) return;
    const t = window.setInterval(() => setI((x) => x + 1), portalConfig.screen.slideSeconds * 1000);
    return () => window.clearInterval(t);
  }, [count]);
  return i;
}

function ScreenPreview({ index, item }: { index: number; item: MediaItem | null }) {
  const { widthPx, heightPx } = portalConfig.screen;
  const url = useFileUrl(item?.file);
  return (
    <figure className="screen">
      <div className="screen-frame" style={{ aspectRatio: `${widthPx} / ${heightPx}` }}>
        {item && url ? (
          item.kind === 'video' ? (
            <video key={url} src={url} autoPlay muted loop playsInline />
          ) : (
            <img src={url} alt={item.file.name} />
          )
        ) : (
          <span className="screen-empty">Your photos and videos will play here</span>
        )}
      </div>
      <figcaption>
        Screen {index + 1}
        <span className="muted">
          {' '}
          {widthPx} x {heightPx} px
        </span>
      </figcaption>
    </figure>
  );
}

function MediaUploader({ design, update }: { design: DesignState; update: UpdateDesign }) {
  const { storage } = useServices();
  const rule = portalConfig.uploads.media;
  const [timing, setTiming] = useState<Timing | ''>('');
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length || !timing) return;
    setBusy(true);
    const errs: string[] = [];
    const added: MediaItem[] = [];
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
    setErrors(errs);
    setBusy(false);
    if (added.length) update((d) => ({ ...d, media: [...d.media, ...added] }));
  };

  const setItemTiming = (id: string, t: Timing) =>
    update((d) => ({ ...d, media: d.media.map((m) => (m.id === id ? { ...m, timing: t } : m)) }));

  const remove = (item: MediaItem) => {
    void storage.deleteFile(item.file.id);
    update((d) => ({ ...d, media: d.media.filter((m) => m.id !== item.id) }));
  };

  return (
    <div className="uploader">
      <h3>Add photos and videos</h3>
      <div className="row wrap">
        <label className="field inline">
          <span>When should they play?</span>
          <select value={timing} required onChange={(e) => setTiming(e.target.value as Timing)}>
            <option value="" disabled>
              Choose a time
            </option>
            {portalConfig.timings.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" disabled={!timing || busy} onClick={() => input.current?.click()}>
          {busy ? 'Uploading…' : 'Choose files'}
        </button>
      </div>
      {!timing && <p className="muted small">Pick a time of night first, then choose your files.</p>}
      <p className="muted small">
        Photos up to {rule.maxImageMb} MB, videos up to {rule.maxVideoMb} MB.
      </p>
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

      {portalConfig.timings.map((t) => {
        const group = design.media.filter((m) => m.timing === t.id);
        return (
          <div key={t.id} className="media-group">
            <h4>
              {t.label} <span className="muted">({group.length})</span>
            </h4>
            {group.length === 0 ? (
              <p className="muted small">Nothing yet</p>
            ) : (
              <ul className="media-list">
                {group.map((m) => (
                  <MediaRow key={m.id} item={m} onTiming={(v) => setItemTiming(m.id, v)} onRemove={() => remove(m)} />
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MediaRow({
  item,
  onTiming,
  onRemove,
}: {
  item: MediaItem;
  onTiming: (t: Timing) => void;
  onRemove: () => void;
}) {
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
        <select
          aria-label={`When to play ${item.file.name}`}
          value={item.timing}
          required
          onChange={(e) => onTiming(e.target.value as Timing)}
        >
          {portalConfig.timings.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <button type="button" className="link" onClick={onRemove} aria-label={`Remove ${item.file.name}`}>
        Remove
      </button>
    </li>
  );
}
