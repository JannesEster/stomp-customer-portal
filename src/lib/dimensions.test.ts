import { describe, expect, it } from 'vitest';
import { floorPixels, screenCount } from './dimensions';
import { portalConfig } from '../config';

describe('floorPixels', () => {
  it('uses 256 px per metre with 500 mm tiles at 128 px', () => {
    expect(portalConfig.floor).toEqual({ tileSizeMm: 500, tilePx: 128 });
  });

  it('6m x 4.5m is 1536 x 1152 (12 x 9 tiles)', () => {
    expect(floorPixels(6, 4.5)).toEqual({ width: 1536, height: 1152, tilesX: 12, tilesY: 9 });
  });

  it('4m x 3m is 1024 x 768', () => {
    expect(floorPixels(4, 3)).toMatchObject({ width: 1024, height: 768 });
  });

  it('non standard 5m x 4m is 1280 x 1024', () => {
    expect(floorPixels(5, 4)).toMatchObject({ width: 1280, height: 1024 });
  });

  it('follows the configured tile pixel size', () => {
    expect(floorPixels(6, 4.5, { tileSizeMm: 500, tilePx: 104 })).toMatchObject({ width: 1248, height: 936 });
  });
});

describe('screenCount', () => {
  it('passes through 0, 1 and 2', () => {
    expect(screenCount(0)).toBe(0);
    expect(screenCount(1)).toBe(1);
    expect(screenCount(2)).toBe(2);
  });

  it('clamps to the configured maximum and to zero', () => {
    expect(screenCount(5)).toBe(2);
    expect(screenCount(-1)).toBe(0);
    expect(screenCount(Number.NaN)).toBe(0);
  });

  it('screen size comes from config', () => {
    expect(portalConfig.screen).toMatchObject({ widthPx: 512, heightPx: 1536 });
  });
});
