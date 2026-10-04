import type { DateSlotDef, LiveTextDef, NamesSlotDef } from '../config';
import type { GeneratedStyle, InviteTypography } from '../types';
import { drawLive, fontsToLoad, type FrameRect } from './liveText';

type NamesLook = Pick<NamesSlotDef, 'font' | 'weight' | 'italic' | 'uppercase' | 'letterSpacing'>;
type DateLook = Pick<DateSlotDef, 'font' | 'weight' | 'italic' | 'uppercase' | 'letterSpacing' | 'format'>;

interface Lettering {
  names: NamesLook;
  script: boolean;
  connector: string;
  connectorFont: string;
  date: DateLook;
}

/** Font keys are from the fonts map in holding-styles.json. */
const LETTERING: Record<InviteTypography, Lettering> = {
  modern: {
    names: { font: 'tt-ramillas', uppercase: true, letterSpacing: 0.06 },
    script: false,
    connector: 'and',
    connectorFont: 'brittany',
    date: { font: 'cormorant', weight: 600, uppercase: true, letterSpacing: 0.3, format: 'D MMMM YYYY' },
  },
  classic: {
    names: { font: 'cormorant', weight: 600, uppercase: true, letterSpacing: 0.15 },
    script: false,
    connector: 'and',
    connectorFont: 'parisienne',
    date: { font: 'cormorant', weight: 600, uppercase: true, letterSpacing: 0.3, format: 'D MMMM YYYY' },
  },
  romantic: {
    names: { font: 'malibu-ring' },
    script: true,
    connector: '&',
    connectorFont: 'malibu-ring',
    date: { font: 'cormorant', weight: 500, italic: true, letterSpacing: 0.05, format: 'D MMMM YYYY' },
  },
  boho: {
    names: { font: 'hatton', weight: 600 },
    script: false,
    connector: 'and',
    connectorFont: 'brittany',
    date: { font: 'josefin', weight: 400, uppercase: true, letterSpacing: 0.25, format: 'DD.MM.YYYY' },
  },
  deco: {
    names: { font: 'tan-pearl', uppercase: true, letterSpacing: 0.2 },
    script: false,
    connector: '&',
    connectorFont: 'cormorant',
    date: { font: 'josefin', weight: 600, uppercase: true, letterSpacing: 0.35, format: 'DD . MM . YYYY' },
  },
};

/** The text layers of a generated design. Positions are fractions of the floor, sizes of its height. */
export function generatedLayers(g: GeneratedStyle): LiveTextDef[] {
  const l = LETTERING[g.typography];
  const names = (over: Partial<NamesSlotDef>): NamesSlotDef => ({
    ...l.names,
    layout: 'stacked',
    connector: l.connector,
    connectorFont: l.connectorFont,
    connectorSize: 0.065,
    lineHeight: l.script ? 0.15 : 0.135,
    colour: g.text,
    maxWidth: 0.72,
    x: 0.5,
    y: 0.47,
    size: l.script ? 0.15 : 0.1,
    ...over,
  });
  const date = (y: number): DateSlotDef => ({ ...l.date, x: 0.5, y, size: 0.034, colour: g.accent, maxWidth: 0.6 });
  const bigInitial = (layout: 'firstInitial' | 'secondInitial', x: number, y: number) => ({
    names: {
      ...l.names,
      layout,
      uppercase: true,
      letterSpacing: 0,
      x,
      y,
      size: 0.62,
      colour: withAlpha(g.text, 0.12),
      maxWidth: 0.5,
    },
  });

  switch (g.layout) {
    case 'monogram':
      return [
        bigInitial('firstInitial', 0.3, 0.38),
        bigInitial('secondInitial', 0.7, 0.62),
        { names: names({}), date: date(0.8) },
      ];
    case 'stacked':
      return [{ names: names({ y: 0.46 }), date: date(0.75) }];
    case 'frame':
      return [{ names: names({ layout: 'line', y: 0.46, size: l.script ? 0.13 : 0.085, maxWidth: 0.7 }), date: date(0.6) }];
    case 'minimal':
      return [
        {
          names: names({
            layout: 'line',
            y: 0.47,
            size: l.script ? 0.12 : 0.07,
            maxWidth: 0.8,
            letterSpacing: l.script ? 0 : 0.22,
          }),
          date: date(0.64),
        },
      ];
  }
}

export function generatedFonts(g: GeneratedStyle, fonts: Record<string, string>): string[] {
  return generatedLayers(g).flatMap((def) => fontsToLoad(def, fonts));
}

const PARTICLES = 26;

/** Draws a generated design at the floor's exact size. `time` is in seconds and drives the drifting sparkles. */
export function drawGeneratedFloor(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  g: GeneratedStyle,
  names: string,
  eventDate: string,
  fonts: Record<string, string>,
  time: number,
): void {
  ctx.fillStyle = g.background;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.6);
  glow.addColorStop(0, withAlpha(g.accent, 0.13));
  glow.addColorStop(1, withAlpha(g.accent, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  drawSparkles(ctx, W, H, g, time);
  drawOrnaments(ctx, W, H, g);

  const frame: FrameRect = { ox: 0, oy: 0, dw: W, dh: H };
  for (const def of generatedLayers(g)) drawLive(ctx, frame, { def, names, eventDate, namesColour: null, fonts });
}

function drawSparkles(ctx: CanvasRenderingContext2D, W: number, H: number, g: GeneratedStyle, time: number): void {
  let seed = 9301 + g.variant * 49297;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  ctx.save();
  ctx.fillStyle = g.accent;
  for (let i = 0; i < PARTICLES; i++) {
    const x = rand() * W;
    const speed = 0.01 + rand() * 0.02;
    const y = (((rand() - time * speed) % 1) + 1) % 1;
    const r = (0.002 + rand() * 0.004) * H;
    ctx.globalAlpha = 0.12 + 0.3 * (0.5 + 0.5 * Math.sin(time * (0.8 + rand()) + i));
    ctx.beginPath();
    ctx.arc(x, y * H, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawOrnaments(ctx: CanvasRenderingContext2D, W: number, H: number, g: GeneratedStyle): void {
  ctx.save();
  ctx.strokeStyle = g.accent;
  ctx.fillStyle = g.accent;
  const line = Math.max(1.5, H * 0.0025);
  ctx.lineWidth = line;

  const rule = (y: number, half: number, gap = 0) => {
    ctx.beginPath();
    ctx.moveTo(W / 2 - half, y);
    ctx.lineTo(W / 2 - gap, y);
    ctx.moveTo(W / 2 + gap, y);
    ctx.lineTo(W / 2 + half, y);
    ctx.stroke();
  };
  const diamond = (x: number, y: number, s: number) => {
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.lineTo(x + s, y);
    ctx.lineTo(x, y + s);
    ctx.lineTo(x - s, y);
    ctx.closePath();
    ctx.fill();
  };

  if (g.layout === 'stacked') {
    for (const y of [0.22, 0.86]) {
      rule(y * H, W * 0.09, H * 0.02);
      diamond(W / 2, y * H, H * 0.008);
    }
  } else if (g.layout === 'frame') {
    const m = Math.min(W, H);
    for (const [inset, width] of [
      [0.045, line],
      [0.062, line * 0.6],
    ]) {
      ctx.lineWidth = width;
      ctx.strokeRect(m * inset, m * inset, W - m * inset * 2, H - m * inset * 2);
    }
    const c = m * 0.0535;
    for (const [x, y] of [
      [c, c],
      [W - c, c],
      [c, H - c],
      [W - c, H - c],
    ]) {
      diamond(x, y, m * 0.012);
    }
    ctx.lineWidth = line;
    rule(0.545 * H, W * 0.06);
  } else if (g.layout === 'minimal') {
    rule(0.555 * H, W * 0.05);
  } else {
    rule(0.74 * H, W * 0.04);
  }
  ctx.restore();
}

function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
