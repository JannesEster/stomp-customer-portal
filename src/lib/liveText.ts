import type { LiveTextDef, NamesSlotDef, TextSlotDef } from '../config';

/** Where the style's video frame lands on the floor canvas, after cover fitting. */
export interface FrameRect {
  ox: number;
  oy: number;
  dw: number;
  dh: number;
}

export interface NamesLine {
  text: string;
  connector: boolean;
}

/** Splits "Sam & Alex", "Sam and Alex" or "Sam + Alex" into the two names. */
export function splitNames(names: string): [string, string] | null {
  const parts = names
    .split(/\s*(?:&|\+|\band\b)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length === 2 ? [parts[0], parts[1]] : null;
}

/** The lines of text a style's layout makes from the names field. */
export function namesLines(names: string, slot: NamesSlotDef): NamesLine[] {
  const typed = names.trim();
  if (!typed) return [];
  const pair = splitNames(typed);
  const suffix = slot.suffix ?? '';
  const up = (s: string) => (slot.uppercase ? s.toUpperCase() : s);
  const line = (text: string): NamesLine => ({ text: up(text), connector: false });

  const initial = (s: string) => s.charAt(0).toUpperCase();
  if (slot.layout === 'initials') {
    return [line(pair ? `${initial(pair[0])} & ${initial(pair[1])}` : initial(typed))];
  }
  if (slot.layout === 'firstInitial') return [line(initial(pair ? pair[0] : typed))];
  if (slot.layout === 'secondInitial') return pair ? [line(initial(pair[1]))] : [];
  if (!pair) return [line(typed + suffix)];
  if (slot.layout === 'stacked') {
    return [line(pair[0]), { text: slot.connector ?? '&', connector: true }, line(pair[1] + suffix)];
  }
  if (slot.layout === 'twoLines') return [line(`${pair[0]} &`), line(pair[1] + suffix)];
  return [line(typed + suffix)];
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** Formats an ISO date (YYYY-MM-DD) with a style's date tokens. */
export function formatStyleDate(isoDate: string, format: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const pad = (n: number) => String(n).padStart(2, '0');
  const tokens: Record<string, string> = {
    YYYY: String(y),
    MMMM: MONTHS[m - 1],
    MM: pad(m),
    M: String(m),
    DD: pad(d),
    D: String(d),
  };
  return format.replace(/YYYY|MMMM|MM|M|DD|D/g, (t) => tokens[t]);
}

export interface LiveLayer {
  def: LiveTextDef;
  names: string;
  /** The booking's event date, YYYY-MM-DD */
  eventDate: string;
  /** Overrides the style's names colour, for example with the invite's colour */
  namesColour: string | null;
  fonts: Record<string, string>;
}

/** Draws the couple's names, the event date and any fixed wording over the style's video. */
export function drawLive(ctx: CanvasRenderingContext2D, frame: FrameRect, layer: LiveLayer): void {
  const { def, fonts } = layer;
  const lines = namesLines(layer.names, def.names);
  if (lines.length) drawNames(ctx, frame, def.names, lines, fonts, layer.namesColour ?? def.names.colour);
  if (def.date) {
    const text = formatStyleDate(layer.eventDate, def.date.format);
    drawSlot(ctx, frame, def.date, def.date.uppercase ? text.toUpperCase() : text, fonts);
  }
  for (const f of def.fixed ?? []) drawSlot(ctx, frame, f, f.text, fonts);
}

function toFloor(f: FrameRect, fx: number, fy: number): [number, number] {
  return [f.ox + fx * f.dw, f.oy + fy * f.dh];
}

function drawSlot(ctx: CanvasRenderingContext2D, f: FrameRect, slot: TextSlotDef, text: string, fonts: Record<string, string>) {
  const [x, y] = toFloor(f, slot.x, slot.y);
  drawBlock(ctx, x, y, slot, () =>
    drawFitted(ctx, text, 0, 0, fontFor(slot, fonts), slot.size * f.dh, slot.maxWidth * f.dw, slot),
  );
}

function drawNames(
  ctx: CanvasRenderingContext2D,
  f: FrameRect,
  slot: NamesSlotDef,
  lines: NamesLine[],
  fonts: Record<string, string>,
  colour: string,
): void {
  const [x, y] = toFloor(f, slot.x, slot.y);
  const lineH = (slot.lineHeight ?? slot.size * 1.1) * f.dh;
  const nameFont = fontFor(slot, fonts);
  const connectorFont = `400 ${fonts[slot.connectorFont ?? slot.font] ?? 'cursive'}`;
  const nameSize = slot.size * f.dh;
  const maxW = slot.maxWidth * f.dw;
  const coloured: TextSlotDef = { ...slot, colour };

  // One scale for every name line, so "Sam &" and "Alex" stay the same size.
  let scale = 1;
  for (const l of lines) {
    if (l.connector) continue;
    const w = measure(ctx, l.text, nameFont, nameSize, slot.letterSpacing);
    if (w > maxW) scale = Math.min(scale, maxW / w);
  }

  drawBlock(ctx, x, y, coloured, () => {
    lines.forEach((l, i) => {
      const ly = (i - (lines.length - 1) / 2) * lineH;
      if (l.connector) {
        drawFitted(ctx, l.text, 0, ly, connectorFont, (slot.connectorSize ?? slot.size * 0.6) * f.dh, maxW, {
          ...coloured,
          letterSpacing: 0,
        });
      } else {
        drawFitted(ctx, l.text, 0, ly, nameFont, nameSize * scale, maxW, coloured);
      }
    });
  });
}

function fontFor(slot: TextSlotDef, fonts: Record<string, string>): string {
  return `${slot.italic ? 'italic ' : ''}${slot.weight ?? 400} ${fonts[slot.font] ?? 'serif'}`;
}

/** Moves to the slot's centre, rotates if asked, and sets colour and glow for the text drawn inside. */
function drawBlock(ctx: CanvasRenderingContext2D, x: number, y: number, slot: TextSlotDef, draw: () => void): void {
  ctx.save();
  ctx.translate(x, y);
  if (slot.rotate) ctx.rotate((slot.rotate * Math.PI) / 180);
  ctx.fillStyle = slot.colour;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (slot.shadow) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = Math.max(4, ctx.canvas.height * 0.012);
  }
  draw();
  ctx.restore();
}

function drawFitted(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  font: string,
  size: number,
  maxW: number,
  slot: TextSlotDef,
): void {
  let s = size;
  const w = measure(ctx, text, font, s, slot.letterSpacing);
  if (w > maxW) s *= maxW / w;
  ctx.font = `${fontPrefix(font)} ${Math.round(s)}px ${fontFamily(font)}`;
  setLetterSpacing(ctx, (slot.letterSpacing ?? 0) * s);
  ctx.fillText(text, x, y);
  setLetterSpacing(ctx, 0);
}

function measure(ctx: CanvasRenderingContext2D, text: string, font: string, size: number, spacingEm = 0): number {
  ctx.font = `${fontPrefix(font)} ${Math.round(size)}px ${fontFamily(font)}`;
  setLetterSpacing(ctx, spacingEm * size);
  const w = ctx.measureText(text).width;
  setLetterSpacing(ctx, 0);
  return w;
}

/** `font` here is "[italic ]weight family". These split it so a size can go in between. */
function fontPrefix(font: string): string {
  const m = /^((?:italic )?\d+)\s/.exec(font);
  return m ? m[1] : '400';
}

function fontFamily(font: string): string {
  return font.replace(/^(?:italic )?\d+\s/, '');
}

function setLetterSpacing(ctx: CanvasRenderingContext2D, px: number): void {
  if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${px}px`;
}

/** Font strings to preload, so the first frames don't fall back to a system font. */
export function fontsToLoad(def: LiveTextDef, fonts: Record<string, string>): string[] {
  const slots: TextSlotDef[] = [def.names, ...(def.date ? [def.date] : []), ...(def.fixed ?? [])];
  const list = slots.map((s) => fontFor(s, fonts));
  if (def.names.layout === 'stacked') list.push(`400 ${fonts[def.names.connectorFont ?? def.names.font]}`);
  return list.map((f) => `${fontPrefix(f)} 40px ${fontFamily(f)}`);
}
