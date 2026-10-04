import { describe, expect, it } from 'vitest';
import { generateInviteStyle, readStylingNote, type InviteInputs } from './inviteStyle';
import { contrastRatio, hexLuminance } from './palette';

const blackOnWhite: InviteInputs = { paper: '#fefefe', colours: ['#010101'], note: '' };
const goldOnCream: InviteInputs = { paper: '#faf6ee', colours: ['#c9a227', '#141414'], note: '' };
const goldOnNavy: InviteInputs = { paper: '#1b2340', colours: ['#d4af37', '#f5efe0'], note: '' };

describe('generateInviteStyle', () => {
  it('flips a black on white invite to white lettering on a black floor', () => {
    const g = generateInviteStyle(blackOnWhite, 0);
    expect(g.background).toBe('#000000');
    expect(g.text).toBe('#fefefe');
    expect(g.inverted).toBe(true);
    expect(g.typography).toBe('modern');
  });

  it('keeps a light invite paper colour as the lettering and its accent for details', () => {
    const g = generateInviteStyle(goldOnCream, 0);
    expect(g.inverted).toBe(true);
    expect(g.text).toBe('#faf6ee');
    expect(contrastRatio(g.accent, g.background)).toBeGreaterThanOrEqual(3);
    expect(g.typography).toBe('classic');
  });

  it('keeps a dark invite dark instead of flipping it', () => {
    const g = generateInviteStyle(goldOnNavy, 0);
    expect(g.inverted).toBe(false);
    expect(hexLuminance(g.background)).toBeLessThanOrEqual(0.03);
    expect(g.background).not.toBe('#000000');
  });

  it('never gives a light floor, whatever the invite or note says', () => {
    const inputs: InviteInputs[] = [
      blackOnWhite,
      goldOnCream,
      goldOnNavy,
      { paper: '#ffffff', colours: [], note: 'all white, ivory and cream' },
      { paper: null, colours: ['#ffffff'], note: '' },
    ];
    for (const i of inputs) {
      for (let v = 0; v < 8; v++) {
        const g = generateInviteStyle(i, v);
        expect(hexLuminance(g.background)).toBeLessThanOrEqual(0.03);
        expect(contrastRatio(g.text, g.background)).toBeGreaterThanOrEqual(7);
      }
    }
  });

  it('uses the styling note for mood, accent and floor colour', () => {
    const g = generateInviteStyle({ ...blackOnWhite, note: 'Romantic garden feel, sage green and navy' }, 0);
    expect(g.typography).toBe('romantic');
    expect(g.noteCues).toEqual(['romantic', 'garden', 'sage green', 'navy']);
    expect(g.accent).not.toBe(g.text);
    expect(g.background).not.toBe('#000000');
  });

  it('steps through layouts, then lettering, and is repeatable', () => {
    const layouts = [0, 1, 2, 3].map((v) => generateInviteStyle(blackOnWhite, v).layout);
    expect(new Set(layouts).size).toBe(4);
    expect(generateInviteStyle(blackOnWhite, 4).typography).not.toBe('modern');
    expect(generateInviteStyle(goldOnCream, 2)).toEqual(generateInviteStyle(goldOnCream, 2));
  });
});

describe('readStylingNote', () => {
  it('reads longer colour names before shorter ones', () => {
    expect(readStylingNote('Dusty pink and sage green').colours).toEqual(['#d8a7b1', '#9caf88']);
  });

  it('does not read colours out of other words', () => {
    expect(readStylingNote('Our goldendoodle Credit will be there').colours).toEqual([]);
  });

  it('picks the first mood mentioned', () => {
    expect(readStylingNote('Boho beach vibes but still elegant').mood).toBe('boho');
    expect(readStylingNote('').mood).toBeNull();
  });
});
