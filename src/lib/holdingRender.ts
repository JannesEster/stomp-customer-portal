import type { FontDef, TemplateDef, TextSlot } from '../config';
import type { HoldingDesign } from '../types';

export interface RenderOptions {
  width: number;
  height: number;
  design: HoldingDesign;
  template: TemplateDef;
  font: FontDef;
  photo: HTMLImageElement | null;
  grid: { tilePx: number } | null;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function drawHoldingScreen(ctx: CanvasRenderingContext2D, o: RenderOptions): void {
  const { width: W, height: H, design, template } = o;
  ctx.save();
  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = design.backgroundColour;
  ctx.fillRect(0, 0, W, H);

  if (template.background === 'glow') {
    const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
    g.addColorStop(0, withAlpha(design.accentColour, 0.35));
    g.addColorStop(1, withAlpha(design.accentColour, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  if (template.photo) {
    const frame = frameBox(template.photo, W, H);
    ctx.save();
    clipShape(ctx, template.photo.shape, frame);
    if (o.photo) {
      drawCover(ctx, o.photo, frame, design.photo.zoom, design.photo.posX, design.photo.posY);
    } else {
      ctx.fillStyle = withAlpha(design.accentColour, 0.18);
      ctx.fillRect(frame.x, frame.y, frame.w, frame.h);
      ctx.fillStyle = withAlpha(design.textColour, 0.6);
      ctx.font = `${Math.round(H * 0.035)}px ${o.font.css}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Your photo here', frame.x + frame.w / 2, frame.y + frame.h / 2);
    }
    ctx.restore();

    if (template.photo.shape === 'full') {
      ctx.fillStyle = withAlpha(design.backgroundColour, 0.45);
      ctx.fillRect(0, 0, W, H);
    } else if (template.photo.shape !== 'rect') {
      ctx.save();
      shapePath(ctx, template.photo.shape, frame);
      ctx.strokeStyle = design.accentColour;
      ctx.lineWidth = Math.max(2, H * 0.006);
      ctx.stroke();
      ctx.restore();
    }
  }

  if (template.border) {
    ctx.strokeStyle = design.accentColour;
    const inset = Math.min(W, H) * 0.035;
    ctx.lineWidth = Math.max(2, H * 0.004);
    ctx.strokeRect(inset, inset, W - inset * 2, H - inset * 2);
    const inner = inset + Math.min(W, H) * 0.015;
    ctx.lineWidth = Math.max(1, H * 0.002);
    ctx.strokeRect(inner, inner, W - inner * 2, H - inner * 2);
  }

  ctx.fillStyle = design.textColour;
  drawFittedText(ctx, design.names, template.names, o.font, W, H);
  if (design.secondLine.trim()) {
    drawFittedText(ctx, design.secondLine, template.secondLine, o.font, W, H);
  }

  if (o.grid) drawGrid(ctx, W, H, o.grid.tilePx);
  ctx.restore();
}

function frameBox(p: NonNullable<TemplateDef['photo']>, W: number, H: number): Box {
  const box = { x: p.x * W, y: p.y * H, w: p.w * W, h: p.h * H };
  if (p.shape === 'circle') {
    const d = Math.min(box.w, box.h);
    return { x: box.x + (box.w - d) / 2, y: box.y + (box.h - d) / 2, w: d, h: d };
  }
  return box;
}

function shapePath(ctx: CanvasRenderingContext2D, shape: string, b: Box): void {
  ctx.beginPath();
  if (shape === 'circle') {
    ctx.arc(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, 0, Math.PI * 2);
  } else if (shape === 'arch') {
    const r = b.w / 2;
    ctx.moveTo(b.x, b.y + b.h);
    ctx.lineTo(b.x, b.y + r);
    ctx.arc(b.x + r, b.y + r, r, Math.PI, 0);
    ctx.lineTo(b.x + b.w, b.y + b.h);
    ctx.closePath();
  } else {
    ctx.rect(b.x, b.y, b.w, b.h);
  }
}

function clipShape(ctx: CanvasRenderingContext2D, shape: string, b: Box): void {
  shapePath(ctx, shape, b);
  ctx.clip();
}

/** Cover fit the image into the frame, then zoom and shift towards the focal point. */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  f: Box,
  zoom: number,
  posX: number,
  posY: number,
): void {
  const scale = Math.max(f.w / img.naturalWidth, f.h / img.naturalHeight) * zoom;
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const dx = f.x + (f.w - dw) * (posX / 100);
  const dy = f.y + (f.h - dh) * (posY / 100);
  ctx.drawImage(img, dx, dy, dw, dh);
}

function drawFittedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  slot: TextSlot,
  font: FontDef,
  W: number,
  H: number,
): void {
  let size = Math.round(slot.size * H);
  const maxW = slot.maxWidth * W;
  ctx.textAlign = slot.align;
  ctx.textBaseline = 'middle';
  do {
    ctx.font = `${size}px ${font.css}`;
    if (ctx.measureText(text).width <= maxW) break;
    size -= 2;
  } while (size > 8);
  ctx.fillText(text, slot.x * W, slot.y * H);
}

function drawGrid(ctx: CanvasRenderingContext2D, W: number, H: number, tilePx: number): void {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = tilePx; x < W; x += tilePx) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
  }
  for (let y = tilePx; y < H; y += tilePx) {
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
  }
  ctx.stroke();
}

function withAlpha(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
