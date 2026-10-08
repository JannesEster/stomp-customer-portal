import { useEffect, useRef, useState, type ReactNode } from 'react';
import { findScreenStyle, holdingStylesConfig, portalConfig, type ScreenStyleDef } from '../config';
import { screenCount } from '../lib/dimensions';
import { mediaFor } from '../lib/design';
import { fontsToLoad, formatStyleDate, type FrameRect } from '../lib/liveText';
import { paintScreen } from '../lib/screenRender';
import { useFileUrl } from '../hooks/useFileUrl';
import type { Booking, DesignState, MediaItem, Phase } from '../types';
import { Accent, PhaseSwitch, Section } from './common';

const PHASE_LABELS: Record<Phase, string> = {
  holding: 'Before entrance',
  after: 'After entrance',
  dancing: 'Dancing time',
};

export function ScreensPreview({
  booking,
  design,
  phase,
  onPhaseChange,
}: {
  booking: Booking;
  design: DesignState;
  phase: Phase;
  onPhaseChange: (p: Phase) => void;
}) {
  const screens = screenCount(booking.screensBooked);
  const photos = design.screens.modes[phase] === 'photos';
  const style = photos ? undefined : findScreenStyle(design.screens.styleId);
  const note = (design.screens.note ?? '').trim();
  const items = photos ? mediaFor(design, phase) : [];
  const slide = useSlideIndex(items.length);

  return (
    <Section
      title={
        <>
          Screens <Accent>preview</Accent>
        </>
      }
      intro="These are your portrait screens at their exact shape, for each part of the night."
    >
      <div className="toolbar">
        <PhaseSwitch value={phase} onChange={onPhaseChange} label="Preview phase" labels={PHASE_LABELS} />
      </div>
      <div className="screens">
        {Array.from({ length: screens }, (_, i) =>
          photos ? (
            <MediaScreen key={i} index={i} item={items.length ? items[(slide + i) % items.length] : null} />
          ) : (
            <DesignScreen
              key={i}
              index={i}
              style={style}
              names={customerNames(design, booking)}
              eventDate={booking.eventDate}
              note={note}
            />
          ),
        )}
      </div>
      {style ? (
        <p className="muted small center">
          {style.name}, with your names and your wedding date{note ? ', and the wording you asked for' : ''}.
        </p>
      ) : items.length > 0 ? (
        <p className="muted small center">Your photos and videos take turns on the screens.</p>
      ) : null}
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

function customerNames(design: DesignState, booking: Booking): string {
  return design.designs.holding.names.trim() || booking.coupleNames;
}

const PLAIN: ScreenStyleDef['live'] = {
  names: {
    layout: 'stacked',
    connector: '&',
    x: 0.5,
    y: 0.46,
    size: 0.05,
    lineHeight: 0.06,
    font: 'playfair',
    weight: 600,
    italic: true,
    colour: '#f7f4ef',
    maxWidth: 0.8,
  },
  date: {
    format: 'D MMMM YYYY',
    x: 0.5,
    y: 0.62,
    size: 0.022,
    font: 'josefin',
    colour: '#f7f4ef',
    maxWidth: 0.7,
  },
};

/** Blank artwork, the template wording, and the couple's own names and date. */
function DesignScreen({
  index,
  style,
  names,
  eventDate,
  note,
}: {
  index: number;
  style: ScreenStyleDef | undefined;
  names: string;
  eventDate: string;
  note: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { widthPx, heightPx } = portalConfig.screen;
  const live = style?.live ?? PLAIN;
  const date = eventDate ? formatStyleDate(eventDate, live.date?.format ?? 'D MMMM YYYY') : '';
  const label = [names, date, note.trim() || 'template wording'].filter(Boolean).join('. ');

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    let cancel = false;
    const frame: FrameRect = { ox: 0, oy: 0, dw: widthPx, dh: heightPx };
    const fonts = holdingStylesConfig.fonts;
    void (async () => {
      await Promise.all(fontsToLoad(live, fonts).map((f) => document.fonts.load(f))).catch(() => undefined);
      const img = style ? await loadImage(style.clean) : null;
      if (cancel) return;
      ctx.clearRect(0, 0, widthPx, heightPx);
      if (img) ctx.drawImage(img, 0, 0, widthPx, heightPx);
      else {
        ctx.fillStyle = '#111111';
        ctx.fillRect(0, 0, widthPx, heightPx);
      }
      const coupleOnTemplate = style?.id !== 'rose-quartz';
      paintScreen(
        ctx,
        frame,
        live,
        coupleOnTemplate ? names : '',
        coupleOnTemplate ? eventDate : '',
        note,
        fonts,
        style?.kind ?? 'welcome',
      );
    })();
    return () => {
      cancel = true;
    };
  }, [style, live, names, eventDate, note, widthPx, heightPx]);

  return (
    <Screen index={index}>
      <canvas ref={canvas} className="screen-canvas" width={widthPx} height={heightPx} aria-label={label} />
    </Screen>
  );
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function MediaScreen({ index, item }: { index: number; item: MediaItem | null }) {
  const url = useFileUrl(item?.file);
  return (
    <Screen index={index}>
      {item && url ? (
        item.kind === 'video' ? (
          <video key={url} src={url} autoPlay muted loop playsInline />
        ) : (
          <img src={url} alt={item.file.name} />
        )
      ) : (
        <span className="screen-empty">Your photos and videos will play here</span>
      )}
    </Screen>
  );
}

function Screen({ index, children }: { index: number; children: ReactNode }) {
  const { widthPx, heightPx } = portalConfig.screen;
  return (
    <figure className="screen">
      <div
        className="screen-frame"
        style={{ aspectRatio: `${widthPx} / ${heightPx}`, width: `min(100%, calc(60vh * ${widthPx / heightPx}))` }}
      >
        {children}
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
