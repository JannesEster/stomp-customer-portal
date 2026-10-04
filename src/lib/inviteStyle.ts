import type { DesignState, GeneratedStyle, InviteLayout, InviteTypography } from '../types';
import { contrastRatio, ensureContrast, hexLuminance, hexSaturation, mixHex } from './palette';

/** The styleId a design uses to show the style generated from its invite. */
export const INVITE_STYLE_ID = 'invite';

export const TYPOGRAPHY_LABELS: Record<InviteTypography, string> = {
  modern: 'Modern',
  classic: 'Classic',
  romantic: 'Romantic',
  boho: 'Boho',
  deco: 'Art deco',
};

export const LAYOUT_LABELS: Record<InviteLayout, string> = {
  monogram: 'monogram',
  stacked: 'stacked names',
  frame: 'framed',
  minimal: 'minimal',
};

/** Longer phrases come first so "sage green" is read before "green". */
const COLOUR_WORDS: [string, string][] = [
  ['dusty pink', '#d8a7b1'],
  ['dusty rose', '#c9a9a6'],
  ['dusty blue', '#7d9cb7'],
  ['rose gold', '#b76e79'],
  ['sage green', '#9caf88'],
  ['forest green', '#2f5d3a'],
  ['navy blue', '#1f2a44'],
  ['baby blue', '#a7c7e7'],
  ['burnt orange', '#cc5500'],
  ['blush pink', '#f2c4c4'],
  ['sage', '#9caf88'],
  ['olive', '#808a4f'],
  ['emerald', '#1f7a55'],
  ['green', '#5f8f6b'],
  ['navy', '#1f2a44'],
  ['teal', '#2a8c8c'],
  ['blue', '#5b7fa6'],
  ['burgundy', '#7a1f35'],
  ['maroon', '#6b1e2a'],
  ['wine', '#722f37'],
  ['red', '#b3262f'],
  ['terracotta', '#c96f53'],
  ['rust', '#b7472a'],
  ['orange', '#e07b39'],
  ['peach', '#f4b393'],
  ['coral', '#f08070'],
  ['blush', '#f2c4c4'],
  ['pink', '#e89aae'],
  ['lilac', '#c3a6d6'],
  ['lavender', '#b497d6'],
  ['purple', '#7b4fa0'],
  ['mustard', '#d9a531'],
  ['yellow', '#e8c547'],
  ['gold', '#d4af37'],
  ['champagne', '#e8d3a9'],
  ['silver', '#c0c4c8'],
  ['copper', '#b87333'],
  ['bronze', '#a97142'],
  ['ivory', '#f5efe0'],
  ['cream', '#f3e9d2'],
  ['white', '#ffffff'],
  ['black', '#000000'],
  ['charcoal', '#2b2b2b'],
  ['grey', '#9a9a9a'],
  ['gray', '#9a9a9a'],
  ['brown', '#7a5230'],
  ['taupe', '#a39383'],
];

const MOOD_WORDS: [InviteTypography, string[]][] = [
  ['deco', ['art deco', 'deco', 'gatsby', 'glam', 'glamorous', '1920s', 'roaring twenties']],
  ['modern', ['modern', 'minimal', 'minimalist', 'contemporary', 'clean', 'simple', 'sleek', 'monochrome', 'black and white']],
  ['classic', ['classic', 'traditional', 'timeless', 'formal', 'elegant', 'black tie', 'luxe', 'luxury', 'vintage']],
  ['romantic', ['romantic', 'garden', 'floral', 'flowers', 'whimsical', 'fairytale', 'soft', 'pastel', 'dreamy']],
  ['boho', ['boho', 'bohemian', 'rustic', 'earthy', 'desert', 'natural', 'country', 'barn', 'beach', 'relaxed']],
];

export interface NoteReading {
  mood: InviteTypography | null;
  /** Colours named in the note, in the order they appear */
  colours: string[];
  /** The words that were picked up, in the order they appear */
  cues: string[];
}

/** Picks colour and mood words out of the couple's styling note. */
export function readStylingNote(note: string): NoteReading {
  let text = ` ${note.toLowerCase()} `;
  const found: { at: number; word: string; colour?: string; mood?: InviteTypography }[] = [];
  const take = (phrase: string, extra: { colour?: string; mood?: InviteTypography }) => {
    const re = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
    for (const m of text.matchAll(re)) found.push({ at: m.index ?? 0, word: phrase, ...extra });
    // Blank the phrase out so "sage green" isn't also read as "green".
    text = text.replace(re, (s) => ' '.repeat(s.length));
  };
  for (const [mood, words] of MOOD_WORDS) for (const w of words) take(w, { mood });
  for (const [word, colour] of COLOUR_WORDS) take(word, { colour });
  found.sort((a, b) => a.at - b.at);

  const colours = [...new Set(found.filter((f) => f.colour).map((f) => f.colour!))];
  return {
    mood: found.find((f) => f.mood)?.mood ?? null,
    colours,
    cues: [...new Set(found.map((f) => f.word))],
  };
}

const LAYOUTS: Record<InviteTypography, InviteLayout[]> = {
  modern: ['monogram', 'minimal', 'stacked', 'frame'],
  classic: ['frame', 'stacked', 'monogram', 'minimal'],
  romantic: ['stacked', 'frame', 'minimal', 'monogram'],
  boho: ['stacked', 'minimal', 'frame', 'monogram'],
  deco: ['frame', 'minimal', 'monogram', 'stacked'],
};

const TYPOGRAPHY_ORDER: InviteTypography[] = ['modern', 'classic', 'romantic', 'boho', 'deco'];

/** A floor this dark or darker reads as black on the LED tiles. */
const DARK_FLOOR = 0.03;

export interface InviteInputs {
  /** The invite's paper colour, if known */
  paper: string | null;
  /** The invite's colours, most characteristic first */
  colours: string[];
  note: string;
}

export function inviteInputs(d: Pick<DesignState, 'invitePaper' | 'invitePalette' | 'stylingNote'>): InviteInputs {
  return { paper: d.invitePaper, colours: d.invitePalette, note: d.stylingNote };
}

export function basedOnKey(i: InviteInputs): string {
  return JSON.stringify([i.paper, i.colours, i.note.trim().toLowerCase()]);
}

/**
 * Builds a holding screen from the invite. The floor is always dark, because large
 * areas of white look harsh on LED, so a light invite is flipped: its paper colour
 * becomes the lettering on a black floor. Variant 0 is the best match; higher
 * variants step through other layouts, then other lettering, with the same colours.
 */
export function generateInviteStyle(input: InviteInputs, variant: number): GeneratedStyle {
  const note = readStylingNote(input.note);
  const paper = input.paper ?? '#ffffff';
  const inverted = hexLuminance(paper) > 0.3;
  const chromatic = input.colours.filter((c) => hexSaturation(c) > 0.25 && hexLuminance(c) > 0.03);
  const noteDark = note.colours.find((c) => hexLuminance(c) < 0.06);
  const noteAccent = note.colours.find((c) => hexSaturation(c) > 0.2 && hexLuminance(c) >= 0.06);
  const noteLight = note.colours.find((c) => hexLuminance(c) > 0.6);

  const background = noteDark ? darkFloor(noteDark) : inverted ? '#000000' : darkFloor(paper);
  const lettering = inverted
    ? paper
    : (input.colours.find((c) => contrastRatio(c, background) >= 7) ?? '#ffffff');
  const text = ensureContrast(noteLight ?? lettering, background, 7);
  const accentSource =
    noteAccent ?? chromatic[0] ?? input.colours.find((c) => contrastRatio(c, background) >= 3) ?? text;
  const accent = ensureContrast(accentSource, background, 3);

  const best: InviteTypography =
    note.mood ?? (chromatic.length === 0 ? 'modern' : isGold(accentSource) ? 'classic' : 'romantic');
  const order = [best, ...TYPOGRAPHY_ORDER.filter((t) => t !== best)];
  const v = Math.max(0, Math.floor(variant));
  const typography = order[Math.floor(v / 4) % order.length];

  return {
    variant: v,
    typography,
    layout: LAYOUTS[typography][v % 4],
    background,
    text,
    accent,
    inverted,
    noteCues: note.cues,
    basedOn: basedOnKey(input),
  };
}

function darkFloor(colour: string): string {
  let c = colour;
  for (let i = 0; i < 20 && hexLuminance(c) > DARK_FLOOR; i++) c = mixHex(c, '#000000', 0.2);
  return c;
}

function isGold(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min || r !== max) return false;
  const hue = (60 * (g - b)) / (max - min);
  return hue >= 30 && hue <= 58 && (max - min) / max > 0.35;
}
