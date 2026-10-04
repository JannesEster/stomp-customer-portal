import { portalConfig, type FloorConfig, type ScreenConfig } from '../config';

export interface FloorPixels {
  width: number;
  height: number;
  tilesX: number;
  tilesY: number;
}

/** Pixel size of the floor canvas. With 500 mm tiles at 128 px, that is 256 px per metre. */
export function floorPixels(
  widthM: number,
  lengthM: number,
  floor: FloorConfig = portalConfig.floor,
): FloorPixels {
  const tilesX = (widthM * 1000) / floor.tileSizeMm;
  const tilesY = (lengthM * 1000) / floor.tileSizeMm;
  return {
    width: Math.round(tilesX * floor.tilePx),
    height: Math.round(tilesY * floor.tilePx),
    tilesX,
    tilesY,
  };
}

/** Screens to render for a booking, clamped to what the config allows. */
export function screenCount(screensBooked: number, screen: ScreenConfig = portalConfig.screen): number {
  if (!Number.isFinite(screensBooked)) return 0;
  return Math.max(0, Math.min(screen.maxScreens, Math.floor(screensBooked)));
}
