import { effectsConfig, findScreenStyle, findStyle, type UploadRule } from '../config';
import { isKnownStepId, type StepId } from '../design/steps';
import { generatedFor } from './inviteStyle';
import type { Booking, DesignState, HoldingDesign, MediaItem, MediaKind, Phase, Timing } from '../types';

export const DESIGN_VERSION = 3;

export function defaultHoldingDesign(booking: Pick<Booking, 'coupleNames'>): HoldingDesign {
  return { styleId: null, names: booking.coupleNames, media: null };
}

export function createDefaultDesign(booking: Pick<Booking, 'coupleNames'>, now = new Date()): DesignState {
  const blank = defaultHoldingDesign(booking);
  return {
    version: DESIGN_VERSION,
    status: 'draft',
    updatedAt: now.toISOString(),
    submittedAt: null,
    designs: { holding: blank, after: { ...blank }, dancing: { ...blank } },
    afterMode: 'same',
    dancingMode: 'blank',
    dancingNote: '',
    entranceTime: '',
    dancingStarts: '',
    submittedWithoutTimes: false,
    reactions: [],
    afterReactions: [],
    media: [],
    screens: { styleId: null, modes: { holding: 'design', after: 'design', dancing: 'design' } },
    invite: null,
    invitePreview: null,
    invitePalette: [],
    inviteNamesColour: null,
    invitePaper: null,
    inviteStyle: null,
    afterInviteStyle: null,
    stylingNote: '',
    liveContentRequested: false,
    confirmedSteps: [],
  };
}

/**
 * Fields added within a version are filled from the defaults. Saved designs from
 * an older version are seed data only, so they are replaced rather than migrated.
 */
export function usableDesign(saved: DesignState | null, booking: Pick<Booking, 'coupleNames'>): DesignState {
  const fresh = createDefaultDesign(booking);
  if (saved?.version !== DESIGN_VERSION) return fresh;
  const merged = { ...fresh, ...saved };
  // Reactions retired from effects.json are dropped.
  const offered = (id: string) => effectsConfig.effects.some((e) => e.id === id);
  merged.reactions = merged.reactions.filter(offered);
  merged.afterReactions = merged.afterReactions.filter(offered);
  merged.dancingNote = merged.dancingNote ?? '';
  merged.entranceTime = merged.entranceTime ?? '';
  merged.dancingStarts = merged.dancingStarts ?? '';
  merged.submittedWithoutTimes = merged.submittedWithoutTimes ?? false;
  merged.confirmedSteps = normaliseConfirmedSteps(merged.confirmedSteps);
  // A blank floor after the entrance is no longer offered.
  return (merged.afterMode as string) === 'blank' ? { ...merged, afterMode: 'same' } : merged;
}

/** Known step ids only, in first-seen order, with duplicates removed. Anything else becomes []. */
export function normaliseConfirmedSteps(value: unknown): StepId[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<StepId>();
  for (const item of value) {
    if (typeof item !== 'string' || !isKnownStepId(item) || seen.has(item)) continue;
    seen.add(item);
  }
  return [...seen];
}

/** Adds a step id once. Already confirmed designs are returned unchanged. */
export function withConfirmed(design: DesignState, stepId: StepId): DesignState {
  if (!isKnownStepId(stepId) || design.confirmedSteps.includes(stepId)) return design;
  return { ...design, confirmedSteps: [...design.confirmedSteps, stepId] };
}

/**
 * Confirms the step that was on screen when the couple leaves it forwards.
 * Back, staying put, and landing on a step do not confirm anything.
 * A jump confirms only the step they left, not the steps in between.
 */
export function confirmOnLeave(
  design: DesignState,
  fromId: StepId,
  toId: StepId,
  steps: readonly { id: StepId }[],
): DesignState {
  const from = steps.findIndex((step) => step.id === fromId);
  const to = steps.findIndex((step) => step.id === toId);
  if (from < 0 || to <= from) return design;
  return withConfirmed(design, fromId);
}

/** A choice on the step that is on screen confirms that step and keeps the edit. */
export function recordStepChoice(
  design: DesignState,
  stepId: StepId,
  change: (design: DesignState) => DesignState,
): DesignState {
  return withConfirmed(change(design), stepId);
}

/** Same as `withConfirmed`, and stamps `updatedAt` only when the list actually grows. Status is left as it is. */
export function confirmStep(design: DesignState, stepId: StepId, now: string): DesignState {
  const next = withConfirmed(design, stepId);
  if (next === design) return design;
  return { ...next, updatedAt: now };
}

/** The design shown in a phase, or null for a blank floor. */
export function holdingFor(design: DesignState, phase: Phase): HoldingDesign | null {
  if (phase === 'holding') return design.designs.holding;
  if (phase === 'after') return design.afterMode === 'different' ? design.designs.after : design.designs.holding;
  return null;
}

/** True while dancing time plays the colourful videos. */
export function showsDancingVideos(design: DesignState, phase: Phase): boolean {
  return phase === 'dancing' && design.dancingMode === 'videos';
}

/**
 * Reactions for a phase. Picks from before the entrance carry on after it.
 * When none were picked before, after the entrance uses its own picks.
 * Dancing time cycles through every effect instead, except for colourful videos or a described design, which have none.
 */
export function reactionsFor(design: DesignState, phase: Phase): { ids: string[]; assorted: boolean } {
  if (phase === 'holding') return { ids: design.reactions, assorted: false };
  if (phase === 'after') {
    return { ids: design.reactions.length ? design.reactions : design.afterReactions, assorted: false };
  }
  if (design.dancingMode === 'videos' || design.dancingMode === 'different') return { ids: [], assorted: false };
  return { ids: effectsConfig.effects.map((e) => e.id), assorted: true };
}

const TIMINGS: Record<Phase, Timing> = { holding: 'start', after: 'middle', dancing: 'end' };

/** Screen photos and videos are saved with a timing, so saved designs keep working if the labels change. */
export function timingFor(phase: Phase): Timing {
  return TIMINGS[phase];
}

/** The photos and videos for the screens in one part of the night, in the order they were added. */
export function mediaFor(design: DesignState, phase: Phase): MediaItem[] {
  return design.media.filter((m) => m.timing === timingFor(phase));
}

export function mediaKindOf(mimeType: string): MediaKind | null {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  return null;
}

/** Returns a customer facing error, or null if the file is allowed. */
export function validateUpload(file: Pick<File, 'name' | 'type' | 'size'>, rule: UploadRule): string | null {
  if (!rule.accept.includes(file.type)) {
    return `${file.name} isn't a supported file type.`;
  }
  const kind = mediaKindOf(file.type);
  const maxMb =
    (kind === 'video' ? rule.maxVideoMb : kind === 'image' ? rule.maxImageMb : undefined) ?? rule.maxMb;
  if (maxMb !== undefined && file.size > maxMb * 1024 * 1024) {
    return `${file.name} is too big. The limit is ${maxMb} MB.`;
  }
  return null;
}

/** File input accept attribute for an upload rule. */
export function acceptAttr(rule: UploadRule): string {
  return rule.accept.join(',');
}

/** A holding screen counts as chosen when it points at a real style or a generated invite design. */
export function holdingStyleChosen(design: DesignState, holding: HoldingDesign): boolean {
  return !!findStyle(holding.styleId) || !!generatedFor(design, holding.styleId);
}

/**
 * Whether the couple has finished a design step.
 * Optional picks (no reactions, the recommended floor after the entrance, a blank dancing floor)
 * count as finished choices. A step that still needs a style, a note, photos, or a submit does not.
 * Screen steps are omitted by `stepsFor` when the booking has no screens, so they are not passed here.
 */
export function isStepComplete(stepId: StepId, design: DesignState): boolean {
  switch (stepId) {
    case 'details':
      return design.designs.holding.names.trim().length > 0;
    case 'floor-design':
      return holdingStyleChosen(design, design.designs.holding);
    case 'floor-reactions':
      return true;
    case 'floor-after':
      return design.afterMode === 'same' || holdingStyleChosen(design, design.designs.after);
    case 'floor-after-reactions':
      return true;
    case 'floor-dancing':
      return design.dancingMode !== 'different' || design.dancingNote.trim().length > 0;
    case 'screens-design':
      return !!findScreenStyle(design.screens.styleId);
    case 'screens-holding':
      return screenPartComplete(design, 'holding');
    case 'screens-after':
      return screenPartComplete(design, 'after');
    case 'screens-dancing':
      return screenPartComplete(design, 'dancing');
    case 'review':
      return design.status === 'submitted';
    default:
      return false;
  }
}

function screenPartComplete(design: DesignState, phase: Phase): boolean {
  if (design.screens.modes[phase] === 'photos') return mediaFor(design, phase).length > 0;
  return !!findScreenStyle(design.screens.styleId);
}
