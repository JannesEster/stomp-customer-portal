import type { GeneratedStyle } from '../types';
import { drawGeneratedFloor } from './generatedRender';
import { drawLive, type FrameRect, type LiveLayer } from './liveText';

export interface GeneratedLayer {
  style: GeneratedStyle;
  names: string;
  eventDate: string;
  fonts: Record<string, string>;
}

export interface FloorFrame {
  width: number;
  height: number;
  /** Holding screen video, or null for a blank floor */
  video: HTMLVideoElement | null;
  /** The couple's names and the date drawn over the video */
  live: LiveLayer | null;
  /** A design generated from the invite, drawn instead of a video */
  generated: GeneratedLayer | null;
  /** Shown in the middle when there is nothing to play yet */
  message: string | null;
  gridTilePx: number | null;
}

/** Draws one frame of the floor at its exact pixel size. */
export function drawFloor(ctx: CanvasRenderingContext2D, f: FloorFrame): void {
  const { width: W, height: H } = f;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  const v = f.video;
  if (f.generated) {
    const g = f.generated;
    drawGeneratedFloor(ctx, W, H, g.style, g.names, g.eventDate, g.fonts, performance.now() / 1000);
  } else if (v && v.readyState >= 2 && v.videoWidth > 0) {
    // Cover fit: floors that aren't 4:3 crop the sample rather than stretch it.
    const scale = Math.max(W / v.videoWidth, H / v.videoHeight);
    const dw = v.videoWidth * scale;
    const dh = v.videoHeight * scale;
    const frame: FrameRect = { ox: (W - dw) / 2, oy: (H - dh) / 2, dw, dh };
    ctx.drawImage(v, frame.ox, frame.oy, dw, dh);
    if (f.live) drawLive(ctx, frame, f.live);
  }

  if (f.message) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.font = `500 ${Math.round(H * 0.04)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(f.message, W / 2, H / 2);
  }

  if (f.gridTilePx) drawGrid(ctx, W, H, f.gridTilePx);
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
