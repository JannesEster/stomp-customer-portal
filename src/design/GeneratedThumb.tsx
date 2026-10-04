import { useEffect, useRef } from 'react';
import { holdingStylesConfig } from '../config';
import { drawGeneratedFloor, generatedFonts } from '../lib/generatedRender';
import type { GeneratedStyle } from '../types';

const W = 480;
const H = 360;

/** A still of a generated design, redrawn once its fonts have loaded. */
export function GeneratedThumb({
  style,
  names,
  eventDate,
  className,
}: {
  style: GeneratedStyle;
  names: string;
  eventDate: string;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    const fonts = holdingStylesConfig.fonts;
    const draw = () => {
      const ctx = ref.current?.getContext('2d');
      if (ctx && !cancelled) drawGeneratedFloor(ctx, W, H, style, names, eventDate, fonts, 0);
    };
    draw();
    void Promise.all(generatedFonts(style, fonts).map((f) => document.fonts.load(f))).then(draw);
    return () => {
      cancelled = true;
    };
  }, [style, names, eventDate]);

  return <canvas ref={ref} width={W} height={H} className={className} aria-hidden />;
}
