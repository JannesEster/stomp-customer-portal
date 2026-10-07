import { useEffect, useState, type ReactNode } from 'react';
import { findScreenStyle, portalConfig } from '../config';
import { screenCount } from '../lib/dimensions';
import { mediaFor } from '../lib/design';
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
            <Screen key={i} index={i}>
              {style ? (
                <img src={style.image} alt={`${style.name} screen design`} />
              ) : (
                <span className="screen-empty">Pick a screen design</span>
              )}
            </Screen>
          ),
        )}
      </div>
      {style ? (
        <p className="muted small center">
          {style.name}, shown with example names. Stomp makes the finished version with your names and date.
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
