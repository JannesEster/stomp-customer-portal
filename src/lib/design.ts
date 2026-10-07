import { effectsConfig, type UploadRule } from '../config';
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
    reactions: [],
    media: [],
    screens: { styleId: null, modes: { holding: 'design', after: 'design', dancing: 'design' } },
    invite: null,
    invitePreview: null,
    invitePalette: [],
    inviteNamesColour: null,
    invitePaper: null,
    inviteStyle: null,
    stylingNote: '',
    liveContentRequested: false,
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
  merged.reactions = merged.reactions.filter((id) => effectsConfig.effects.some((e) => e.id === id));
  // A blank floor after the entrance is no longer offered.
  return (merged.afterMode as string) === 'blank' ? { ...merged, afterMode: 'same' } : merged;
}

/** The design shown in a phase, or null for a blank floor. */
export function holdingFor(design: DesignState, phase: Phase): HoldingDesign | null {
  if (phase === 'holding') return design.designs.holding;
  if (phase === 'after') return design.afterMode === 'different' ? design.designs.after : design.designs.holding;
  return design.dancingMode === 'different' ? design.designs.dancing : null;
}

/** True while dancing time plays the colourful videos. */
export function showsDancingVideos(design: DesignState, phase: Phase): boolean {
  return phase === 'dancing' && design.dancingMode === 'videos';
}

/**
 * Reactions for a phase. Dancing time cycles through every effect instead of the
 * couple's picks, except while the colourful videos play, which have none.
 */
export function reactionsFor(design: DesignState, phase: Phase): { ids: string[]; assorted: boolean } {
  if (phase !== 'dancing') return { ids: design.reactions, assorted: false };
  if (design.dancingMode === 'videos') return { ids: [], assorted: false };
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
