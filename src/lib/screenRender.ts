import type { LiveTextDef, ScreenStyleDef } from '../config';
import { drawLive, type FrameRect } from './liveText';

/** Template wording stays, unless the couple has written their own. Names and the date always stay. */
export function screenCopy(live: LiveTextDef, note: string): LiveTextDef {
  if (!note.trim()) return live;
  return { names: live.names, date: live.date, moreDates: live.moreDates };
}

/** Where a couple's own wording sits: in the list on an order of the day, otherwise where the template wording was. */
export function requestBand(live: LiveTextDef, kind: ScreenStyleDef['kind']): { y: number; bottom: number } {
  const nameY = live.names.y;
  const dateY = live.date?.y ?? nameY;
  const upper = Math.min(nameY, dateY);
  const lower = Math.max(nameY, dateY);
  if (kind === 'schedule') {
    const fixed = live.fixed ?? [];
    const below = fixed.filter((f) => f.y > lower + 0.02);
    const between = fixed.filter((f) => f.y > upper + 0.06 && f.y < lower - 0.02);
    if (below.length > between.length && below.length >= 3) {
      return { y: Math.min(...below.map((f) => f.y)), bottom: 0.92 };
    }
    if (lower - upper > 0.2) return { y: upper + 0.1, bottom: lower - 0.04 };
  }
  const above = (live.fixed ?? []).filter((f) => f.y < upper - 0.12);
  if (above.length >= 2) {
    const y = Math.min(...above.map((f) => f.y));
    const bottom = upper - 0.08;
    if (bottom - y > 0.1) return { y, bottom };
  }
  return { y: lower + 0.045, bottom: 0.93 };
}

/** Draws the couple's own wording, wrapped, in the template's ink. */
export function drawRequest(
  ctx: CanvasRenderingContext2D,
  frame: FrameRect,
  text: string,
  colour: string,
  fontFamily: string,
  band: { y: number; bottom: number },
): void {
  const maxW = frame.dw * 0.74;
  const bandH = Math.max(0, (band.bottom - band.y) * frame.dh);
  let size = frame.dh * 0.02;
  let lines: string[] = [];
  for (let attempt = 0; attempt < 6; attempt++) {
    ctx.font = `500 ${Math.round(size)}px ${fontFamily}`;
    lines = text
      .split(/\n/)
      .flatMap((paragraph) => wrapLine(ctx, paragraph, maxW));
    if (lines.length * size * 1.35 <= bandH || size < frame.dh * 0.012) break;
    size *= 0.85;
  }
  const lineH = size * 1.35;
  const shown = lines.slice(0, Math.max(1, Math.floor(bandH / lineH)));
  ctx.save();
  ctx.fillStyle = colour;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = `500 ${Math.round(size)}px ${fontFamily}`;
  const top = frame.oy + band.y * frame.dh;
  shown.forEach((line, i) => ctx.fillText(line, frame.ox + frame.dw * 0.5, top + i * lineH));
  ctx.restore();
}

function wrapLine(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let current = words[0];
  for (const word of words.slice(1)) {
    const next = `${current} ${word}`;
    if (ctx.measureText(next).width <= maxW) current = next;
    else {
      lines.push(current);
      current = word;
    }
  }
  lines.push(current);
  return lines;
}

export function paintScreen(
  ctx: CanvasRenderingContext2D,
  frame: FrameRect,
  live: LiveTextDef,
  names: string,
  eventDate: string,
  note: string,
  fonts: Record<string, string>,
  kind: ScreenStyleDef['kind'],
): void {
  const copy = screenCopy(live, note);
  drawLive(ctx, frame, {
    def: eventDate ? copy : { ...copy, date: undefined, moreDates: undefined },
    names,
    eventDate,
    namesColour: null,
    fonts,
  });
  if (eventDate) {
    for (const date of copy.moreDates ?? []) {
      drawLive(ctx, frame, { def: { names: live.names, date }, names: '', eventDate, namesColour: null, fonts });
    }
  }
  const requested = note.trim();
  if (requested) {
    drawRequest(ctx, frame, requested, live.names.colour, 'Josefin Sans, sans-serif', requestBand(live, kind));
  }
}
