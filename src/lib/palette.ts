export interface Palette {
  /** The most common colour, usually the paper */
  background: string;
  /** Distinct colours, most characteristic first */
  colours: string[];
}

type Rgb = [number, number, number];

const MIN_SHARE = 0.004;
const MIN_DISTANCE_FROM_BACKGROUND = 60;
const MIN_DISTANCE_BETWEEN = 45;

/**
 * Picks an invite's main colours from RGBA pixel data. Colours are grouped into
 * buckets, the biggest bucket is taken as the paper, and the rest are ranked by
 * how much of the invite they cover and how colourful they are, so a gold accent
 * can outrank plain black text.
 */
export function paletteFromPixels(data: Uint8ClampedArray, max = 5): Palette | null {
  const buckets = new Map<number, { sum: Rgb; n: number }>();
  let total = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const e = buckets.get(key) ?? { sum: [0, 0, 0] as Rgb, n: 0 };
    e.sum[0] += r;
    e.sum[1] += g;
    e.sum[2] += b;
    e.n++;
    buckets.set(key, e);
    total++;
  }
  if (!total) return null;

  const groups = [...buckets.values()]
    .map((e) => ({ rgb: e.sum.map((v) => v / e.n) as Rgb, n: e.n }))
    .sort((a, b) => b.n - a.n);

  const background = groups[0].rgb;
  const visible = groups
    .slice(1)
    .filter((g) => g.n / total >= MIN_SHARE && distance(g.rgb, background) >= MIN_DISTANCE_FROM_BACKGROUND);
  const candidates = visible
    .filter((g) => !visible.some((ink) => ink !== g && isBlend(g.rgb, background, ink.rgb)))
    .map((g) => ({ ...g, score: (g.n / total) * (0.35 + saturation(g.rgb)) }))
    .sort((a, b) => b.score - a.score);

  const picked: Rgb[] = [];
  for (const c of candidates) {
    if (picked.length >= max) break;
    if (picked.every((p) => distance(p, c.rgb) >= MIN_DISTANCE_BETWEEN)) picked.push(c.rgb);
  }
  return { background: toHex(background), colours: picked.map(toHex) };
}

export function hexLuminance(hex: string): number {
  return luminance(fromHex(hex));
}

export function hexSaturation(hex: string): number {
  return saturation(fromHex(hex));
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [hexLuminance(a), hexLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** `t` of 0 gives `a`, 1 gives `b`. */
export function mixHex(a: string, b: string, t: number): string {
  const ca = fromHex(a);
  const cb = fromHex(b);
  return toHex(ca.map((v, i) => v + (cb[i] - v) * t) as Rgb);
}

/** Moves a colour towards white (on dark backgrounds) or black until it stands out from `bg`. */
export function ensureContrast(colour: string, bg: string, min: number): string {
  const towards = hexLuminance(bg) < 0.5 ? '#ffffff' : '#000000';
  let c = colour;
  for (let i = 0; i < 12 && contrastRatio(c, bg) < min; i++) c = mixHex(c, towards, 0.15);
  return c;
}

/** Contrast needed against the black of an unlit LED floor, the same 4.5 ratio used for readable text. */
const MIN_FLOOR_CONTRAST = 4.5;

/**
 * The colour for the couple's names on the floor. LED floors are mostly black,
 * so a dark invite colour like black or navy can't be used. Falls back to the
 * paper colour, so a black on white invite gives white names.
 */
export function floorNamesColour(palette: Palette): string {
  const readable = (hex: string) => (luminance(fromHex(hex)) + 0.05) / 0.05 >= MIN_FLOOR_CONTRAST;
  return palette.colours.find(readable) ?? (readable(palette.background) ? palette.background : '#ffffff');
}

function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function fromHex(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const BLEND_TOLERANCE = 20;

/**
 * True when `c` sits partway between the paper and an ink colour. Those are the
 * soft edges of text and artwork, like the greys around thin black lettering.
 */
function isBlend(c: Rgb, paper: Rgb, ink: Rgb): boolean {
  const v = ink.map((x, i) => x - paper[i]);
  const w = c.map((x, i) => x - paper[i]);
  const vv = v[0] * v[0] + v[1] * v[1] + v[2] * v[2];
  if (vv === 0) return false;
  const t = (w[0] * v[0] + w[1] * v[1] + w[2] * v[2]) / vv;
  if (t <= 0.05 || t >= 0.95) return false;
  return Math.hypot(w[0] - t * v[0], w[1] - t * v[1], w[2] - t * v[2]) <= BLEND_TOLERANCE;
}

function distance(a: Rgb, b: Rgb): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function saturation([r, g, b]: Rgb): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

function toHex(rgb: Rgb): string {
  return `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}
