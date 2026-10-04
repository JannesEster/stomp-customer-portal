import { describe, expect, it } from 'vitest';
import { floorNamesColour, paletteFromPixels } from './palette';

/** Builds RGBA pixel data from [colour, pixel count] pairs. */
function pixels(parts: [[number, number, number], number][]): Uint8ClampedArray {
  const total = parts.reduce((n, [, count]) => n + count, 0);
  const data = new Uint8ClampedArray(total * 4);
  let i = 0;
  for (const [[r, g, b], count] of parts) {
    for (let k = 0; k < count; k++, i += 4) data.set([r, g, b, 255], i);
  }
  return data;
}

describe('paletteFromPixels', () => {
  it('treats the most common colour as the paper', () => {
    const p = paletteFromPixels(pixels([[[250, 246, 238], 8000], [[20, 20, 20], 1500], [[201, 162, 39], 500]]));
    expect(p?.background).toBe('#faf6ee');
  });

  it('ranks a gold accent ahead of more plentiful black text', () => {
    const p = paletteFromPixels(pixels([[[250, 246, 238], 8000], [[20, 20, 20], 1500], [[201, 162, 39], 500]]));
    expect(p?.colours[0]).toBe('#c9a227');
    expect(p?.colours).toContain('#141414');
  });

  it('ignores specks and colours too close to the paper', () => {
    const p = paletteFromPixels(
      pixels([[[250, 246, 238], 9000], [[240, 236, 228], 900], [[200, 30, 30], 10], [[60, 90, 70], 600]]),
    );
    expect(p?.colours).toEqual(['#3c5a46']);
  });

  it('ignores the grey edges of thin black lettering on white', () => {
    const p = paletteFromPixels(
      pixels([
        [[255, 255, 255], 8000],
        [[0, 0, 0], 900],
        [[216, 216, 216], 400],
        [[184, 184, 184], 300],
        [[151, 151, 151], 250],
      ]),
    );
    expect(p).toEqual({ background: '#ffffff', colours: ['#000000'] });
    expect(floorNamesColour(p!)).toBe('#ffffff');
  });

  it('keeps a real second colour that is not a blend', () => {
    const p = paletteFromPixels(pixels([[[255, 255, 255], 8000], [[0, 0, 0], 900], [[201, 162, 39], 400]]));
    expect(p?.colours).toEqual(['#c9a227', '#000000']);
  });

  it('skips transparent pixels and returns null when there is nothing', () => {
    expect(paletteFromPixels(new Uint8ClampedArray([255, 0, 0, 0]))).toBeNull();
  });
});

describe('floorNamesColour', () => {
  it('uses a light accent such as gold', () => {
    expect(floorNamesColour({ background: '#faf6ee', colours: ['#c9a227', '#141414'] })).toBe('#c9a227');
  });

  it('skips colours too dark to read on the black floor', () => {
    expect(floorNamesColour({ background: '#faf6ee', colours: ['#3d5945', '#d8a7b1'] })).toBe('#d8a7b1');
  });

  it('gives white names for a black on white invite', () => {
    expect(floorNamesColour({ background: '#ffffff', colours: ['#111111'] })).toBe('#ffffff');
  });

  it('falls back to white when the paper is dark too', () => {
    expect(floorNamesColour({ background: '#1a1a2e', colours: ['#0b1d3a'] })).toBe('#ffffff');
  });
});
