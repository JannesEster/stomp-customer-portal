import { dancingVideosConfig, findStyle, holdingStylesConfig, type LiveTextDef } from '../config';
import { floorPixels, SAMPLE_FLOOR } from '../lib/dimensions';
import { holdingFor, showsDancingVideos } from '../lib/design';
import { drawFloor } from '../lib/floorRender';
import { drawLive, fontsToLoad } from '../lib/liveText';
import { generatedFonts } from '../lib/generatedRender';
import { generatedFor } from '../lib/inviteStyle';
import type { Booking, DesignState, Phase } from '../types';

const MAX_EDGE = 720;

/** Names on a plain floor until a style is picked. Matches the on-screen preview. */
const PLAIN_NAMES: LiveTextDef = {
  names: {
    layout: 'line',
    x: 0.5,
    y: 0.5,
    size: 0.14,
    font: 'playfair',
    weight: 700,
    italic: true,
    colour: '#ffffff',
    maxWidth: 0.8,
  },
};

export interface FloorPreviewImage {
  phase: Phase;
  dataUrl: string;
}

/**
 * Inputs that change the floor picture. Times, notes about the venue, and screen choices do not.
 * Used so a preview is uploaded only when this picture actually changed, and again on submit.
 */
export function floorPreviewHash(design: DesignState): string {
  return JSON.stringify({
    holding: design.designs.holding,
    after: design.designs.after,
    afterMode: design.afterMode,
    dancingMode: design.dancingMode,
    dancingNote: design.dancingNote,
    reactions: design.reactions,
    afterReactions: design.afterReactions,
    inviteStyle: design.inviteStyle,
    afterInviteStyle: design.afterInviteStyle,
    inviteNamesColour: design.inviteNamesColour,
  });
}

export function shouldUploadFloorPreview(previousHash: string | null, nextHash: string, reason: 'change' | 'submit'): boolean {
  if (reason === 'submit') return true;
  return previousHash !== nextHash;
}

/**
 * PNG snapshots of the floor. The holding view is required. After the entrance and dancing time
 * are included when they can be drawn. Returns null when no PNG could be made, so the caller
 * leaves the attachment field untouched.
 */
export async function captureFloorPngs(booking: Booking, design: DesignState): Promise<FloorPreviewImage[] | null> {
  if (typeof document === 'undefined') return null;
  const images: FloorPreviewImage[] = [];
  for (const phase of ['holding', 'after', 'dancing'] as const) {
    const dataUrl = await capturePhase(booking, design, phase);
    if (!dataUrl) {
      if (phase === 'holding') return images.length ? images : null;
      continue;
    }
    images.push({ phase, dataUrl });
  }
  return images.length ? images : null;
}

async function capturePhase(booking: Booking, design: DesignState, phase: Phase): Promise<string | null> {
  const live = document.querySelector<HTMLCanvasElement>(`canvas.floor-canvas[data-phase="${phase}"]`);
  if (live && live.width > 0 && live.height > 0) {
    const fromLive = await blobToDataUrl(await scaleCanvas(live));
    if (fromLive) return fromLive;
  }
  const drawn = await drawOffscreen(booking, design, phase);
  return blobToDataUrl(drawn);
}

function scaleCanvas(source: HTMLCanvasElement): Promise<Blob | null> {
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(source.width, source.height));
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return Promise.resolve(null);
    ctx.drawImage(source, 0, 0, width, height);
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'));
  } catch {
    return Promise.resolve(null);
  }
}

async function drawOffscreen(booking: Booking, design: DesignState, phase: Phase): Promise<Blob | null> {
  const floor = booking.floor ?? SAMPLE_FLOOR;
  const px = floorPixels(floor.widthM, floor.lengthM);
  const scale = Math.min(1, MAX_EDGE / Math.max(px.width, px.height));
  const width = Math.max(1, Math.round(px.width * scale));
  const height = Math.max(1, Math.round(px.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const holding = holdingFor(design, phase);
  const generated = generatedFor(design, holding?.styleId);
  const style = generated ? undefined : findStyle(holding?.styleId ?? null);
  const names = holding?.names ?? '';
  const plain = !!holding && !style && !generated;
  const liveDef = style?.live ?? (plain && names.trim() ? PLAIN_NAMES : null);
  const fonts = holdingStylesConfig.fonts;
  const message = phase === 'dancing' && design.dancingMode === 'different' ? design.dancingNote.trim() || 'Different design' : null;

  try {
    const list = generated ? generatedFonts(generated, fonts) : liveDef ? fontsToLoad(liveDef, fonts) : [];
    await Promise.all(list.map((font) => document.fonts.load(font))).catch(() => undefined);
  } catch {
    /* Drawing still works if a font is missing. */
  }

  const posterSrc = style?.poster ?? (showsDancingVideos(design, phase) ? dancingVideosConfig.videos[0]?.poster : null);
  const poster = posterSrc ? await loadImage(posterSrc) : null;

  if (poster) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    const fit = Math.max(width / poster.width, height / poster.height);
    const dw = poster.width * fit;
    const dh = poster.height * fit;
    const frame = { ox: (width - dw) / 2, oy: (height - dh) / 2, dw, dh };
    ctx.drawImage(poster, frame.ox, frame.oy, dw, dh);
    if (generated) {
      drawFloor(ctx, {
        width,
        height,
        video: null,
        live: null,
        generated: { style: generated, names, eventDate: booking.eventDate, fonts },
        message: null,
        gridTilePx: null,
      });
    } else if (liveDef) {
      drawLive(ctx, frame, {
        def: liveDef,
        names,
        eventDate: booking.eventDate,
        namesColour: design.inviteNamesColour,
        fonts,
      });
    }
  } else {
    drawFloor(ctx, {
      width,
      height,
      video: null,
      live: liveDef
        ? { def: liveDef, names, eventDate: booking.eventDate, namesColour: design.inviteNamesColour, fonts }
        : null,
      generated: generated ? { style: generated, names, eventDate: booking.eventDate, fonts } : null,
      message: plain && !names.trim() ? 'Your names will show here' : message,
      gridTilePx: null,
    });
  }

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'));
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function blobToDataUrl(blob: Blob | null): Promise<string | null> {
  if (!blob) return Promise.resolve(null);
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

export async function postFloorPreviews(token: string, images: FloorPreviewImage[]): Promise<void> {
  const response = await fetch(`/api/portal/${encodeURIComponent(token)}/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      images: images.map((image) => ({ phase: image.phase, png: image.dataUrl })),
    }),
  });
  if (!response.ok) throw new Error('preview_failed');
}

export async function postPortalAnswers(token: string, design: DesignState): Promise<{ lastSavedAt: string }> {
  const response = await fetch(`/api/portal/${encodeURIComponent(token)}/answers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ answers: design }),
  });
  if (!response.ok) throw new Error('save_failed');
  const body = (await response.json()) as { lastSavedAt?: unknown };
  return { lastSavedAt: typeof body.lastSavedAt === 'string' ? body.lastSavedAt : new Date().toISOString() };
}

export function beaconPortalAnswers(token: string, design: DesignState): void {
  const url = `/api/portal/${encodeURIComponent(token)}/answers`;
  const blob = new Blob([JSON.stringify({ answers: design })], { type: 'application/json' });
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function' && navigator.sendBeacon(url, blob)) {
    return;
  }
  void fetch(url, { method: 'POST', body: blob, keepalive: true, headers: { 'Content-Type': 'application/json' } });
}
