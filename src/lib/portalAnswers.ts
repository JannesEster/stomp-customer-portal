import { isKnownStepId, STEP_IDS, type StepId } from '../design/steps';
import { DESIGN_VERSION, usableDesign } from './design';
import type { DesignState, GeneratedStyle, HoldingDesign, MediaItem, ScreenMode, ScreensDesign, StoredFile } from '../types';

/** Stored Portal answers JSON must stay under Airtable's long text comfort limit. */
export const MAX_PORTAL_ANSWERS_CHARS = 90_000;

const LIMITS = {
  names: 120,
  note: 2_000,
  fileName: 180,
  fileType: 80,
  fileId: 80,
  colour: 32,
  time: 5,
  id: 80,
  iso: 40,
  reactions: 40,
  media: 40,
  palette: 12,
  noteCues: 12,
  cue: 40,
  basedOn: 200,
} as const;

const TYPOGRAPHY = ['modern', 'classic', 'romantic', 'boho', 'deco'] as const;
const LAYOUTS = ['monogram', 'stacked', 'frame', 'minimal'] as const;

export type AnswersResult = { ok: true; design: DesignState } | { ok: false };

/**
 * Strict shape check for a posted design. Unknown keys are dropped.
 * Wrong types are rejected. Strings and arrays are capped.
 * The result is passed through `usableDesign`, the same normaliser the SPA uses.
 */
export function sanitizePortalAnswers(input: unknown, coupleNames: string): AnswersResult {
  try {
    const design = readDesign(input, coupleNames);
    const normalised = usableDesign(design, { coupleNames });
    if (JSON.stringify(normalised).length > MAX_PORTAL_ANSWERS_CHARS) return { ok: false };
    return { ok: true, design: normalised };
  } catch {
    return { ok: false };
  }
}

class BadAnswers extends Error {}

function readDesign(input: unknown, coupleNames: string): DesignState {
  const root = objectOf(input);
  if (root.version !== DESIGN_VERSION) throw new BadAnswers();
  const status = root.status === 'submitted' ? 'submitted' : root.status === 'draft' ? 'draft' : null;
  if (!status) throw new BadAnswers();
  const designs = objectOf(root.designs);
  const holding = readHolding(designs.holding, coupleNames);
  const afterMode = root.afterMode === 'different' ? 'different' : root.afterMode === 'same' ? 'same' : null;
  if (!afterMode) throw new BadAnswers();
  const dancingMode =
    root.dancingMode === 'videos' || root.dancingMode === 'different' || root.dancingMode === 'blank'
      ? root.dancingMode
      : null;
  if (!dancingMode) throw new BadAnswers();

  const design: DesignState = {
    version: DESIGN_VERSION,
    status,
    updatedAt: readIso(root.updatedAt),
    submittedAt: root.submittedAt == null ? null : readIso(root.submittedAt),
    designs: {
      holding,
      after: readHolding(designs.after, holding.names),
      dancing: readHolding(designs.dancing, holding.names),
    },
    afterMode,
    dancingMode,
    dancingNote: optionalString(root.dancingNote, LIMITS.note),
    entranceTime: readTime(root.entranceTime),
    dancingStarts: readTime(root.dancingStarts),
    submittedWithoutTimes: optionalBoolean(root.submittedWithoutTimes),
    reactions: readIdList(root.reactions),
    afterReactions: readIdList(root.afterReactions),
    media: readMedia(root.media),
    screens: readScreens(root.screens),
    invite: root.invite == null ? null : readFile(root.invite),
    invitePreview: root.invitePreview == null ? null : readFile(root.invitePreview),
    invitePalette: readShortStrings(root.invitePalette, LIMITS.palette, LIMITS.colour),
    inviteNamesColour: root.inviteNamesColour == null ? null : requiredString(root.inviteNamesColour, LIMITS.colour),
    invitePaper: root.invitePaper == null ? null : requiredString(root.invitePaper, LIMITS.colour),
    inviteStyle: root.inviteStyle == null ? null : readGenerated(root.inviteStyle),
    afterInviteStyle: root.afterInviteStyle == null ? null : readGenerated(root.afterInviteStyle),
    stylingNote: optionalString(root.stylingNote, LIMITS.note),
    liveContentRequested: optionalBoolean(root.liveContentRequested),
    confirmedSteps: root.confirmedSteps == null ? [] : readConfirmedSteps(root.confirmedSteps),
    weddingPlanner: optionalString(root.weddingPlanner, LIMITS.names),
    photographer: optionalString(root.photographer, LIMITS.names),
    videographer: optionalString(root.videographer, LIMITS.names),
    dj: optionalString(root.dj, LIMITS.names),
    otherSuppliers: optionalString(root.otherSuppliers, LIMITS.note),
  };
  return design;
}

function readHolding(value: unknown, fallbackNames: string): HoldingDesign {
  const source = objectOf(value);
  return {
    styleId: source.styleId == null ? null : requiredString(source.styleId, LIMITS.id),
    names: source.names == null ? fallbackNames : requiredString(source.names, LIMITS.names),
    media: source.media == null ? null : readFile(source.media),
  };
}

function readFile(value: unknown): StoredFile {
  const source = objectOf(value);
  const size = source.size;
  if (typeof size !== 'number' || !Number.isFinite(size) || size < 0) throw new BadAnswers();
  return {
    id: requiredString(source.id, LIMITS.fileId),
    name: requiredString(source.name, LIMITS.fileName),
    type: requiredString(source.type, LIMITS.fileType),
    size: Math.min(Math.round(size), 2_000_000_000),
  };
}

function readScreens(value: unknown): ScreensDesign {
  const source = objectOf(value);
  const modes = objectOf(source.modes);
  return {
    styleId: source.styleId == null ? null : requiredString(source.styleId, LIMITS.id),
    note: optionalString(source.note, LIMITS.note),
    modes: {
      holding: readMode(modes.holding),
      after: readMode(modes.after),
      dancing: readMode(modes.dancing),
    },
  };
}

function readMode(value: unknown): ScreenMode {
  if (value !== 'design' && value !== 'photos') throw new BadAnswers();
  return value;
}

function readMedia(value: unknown): MediaItem[] {
  return arrayOf(value, LIMITS.media).map((item) => {
    const source = objectOf(item);
    const kind = source.kind;
    const timing = source.timing;
    if (kind !== 'image' && kind !== 'video') throw new BadAnswers();
    if (timing !== 'start' && timing !== 'middle' && timing !== 'end') throw new BadAnswers();
    return {
      id: requiredString(source.id, LIMITS.id),
      file: readFile(source.file),
      kind,
      timing,
      addedAt: readIso(source.addedAt),
    };
  });
}

function readGenerated(value: unknown): GeneratedStyle {
  const source = objectOf(value);
  const typography = source.typography;
  const layout = source.layout;
  const variant = source.variant;
  if (typeof typography !== 'string' || !TYPOGRAPHY.includes(typography as (typeof TYPOGRAPHY)[number])) {
    throw new BadAnswers();
  }
  if (typeof layout !== 'string' || !LAYOUTS.includes(layout as (typeof LAYOUTS)[number])) throw new BadAnswers();
  if (typeof variant !== 'number' || !Number.isFinite(variant) || variant < 0 || variant > 1_000) throw new BadAnswers();
  return {
    variant: Math.round(variant),
    typography: typography as GeneratedStyle['typography'],
    layout: layout as GeneratedStyle['layout'],
    background: requiredString(source.background, LIMITS.colour),
    text: requiredString(source.text, LIMITS.colour),
    accent: requiredString(source.accent, LIMITS.colour),
    inverted: source.inverted === true,
    noteCues: readShortStrings(source.noteCues ?? [], LIMITS.noteCues, LIMITS.cue),
    basedOn: requiredString(source.basedOn, LIMITS.basedOn),
  };
}

function readIdList(value: unknown): string[] {
  return arrayOf(value, LIMITS.reactions).map((item) => requiredString(item, LIMITS.id));
}

/** Missing lists are handled by the caller. Unknown ids are dropped. Duplicates are dropped. */
function readConfirmedSteps(value: unknown): StepId[] {
  if (!Array.isArray(value)) throw new BadAnswers();
  const seen = new Set<StepId>();
  for (const item of value) {
    if (typeof item !== 'string') throw new BadAnswers();
    if (!isKnownStepId(item) || seen.has(item)) continue;
    seen.add(item);
    if (seen.size >= STEP_IDS.length) break;
  }
  return [...seen];
}

function readShortStrings(value: unknown, maxItems: number, maxLen: number): string[] {
  return arrayOf(value, maxItems).map((item) => requiredString(item, maxLen));
}

function readTime(value: unknown): string {
  if (value == null || value === '') return '';
  const time = requiredString(value, LIMITS.time);
  if (!/^\d{2}:\d{2}$/.test(time)) throw new BadAnswers();
  return time;
}

function readIso(value: unknown): string {
  const iso = requiredString(value, LIMITS.iso);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(iso)) throw new BadAnswers();
  return iso;
}

function optionalString(value: unknown, max: number): string {
  if (value == null) return '';
  return requiredString(value, max);
}

function optionalBoolean(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value !== 'boolean') throw new BadAnswers();
  return value;
}

function requiredString(value: unknown, max: number): string {
  if (typeof value !== 'string') throw new BadAnswers();
  return value.slice(0, max);
}

function objectOf(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadAnswers();
  return value as Record<string, unknown>;
}

function arrayOf(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value)) throw new BadAnswers();
  return value.slice(0, max);
}
