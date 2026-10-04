import { templatesConfig, type UploadRule } from '../config';
import type { Booking, DesignState, HoldingDesign, MediaKind, Phase } from '../types';

export function defaultHoldingDesign(booking: Pick<Booking, 'coupleNames'>): HoldingDesign {
  const d = templatesConfig.defaults;
  return {
    templateId: d.templateId,
    names: booking.coupleNames,
    secondLine: '',
    fontId: d.fontId,
    textColour: d.textColour,
    backgroundColour: d.backgroundColour,
    accentColour: d.accentColour,
    photo: { file: null, zoom: 1, posX: 50, posY: 50 },
  };
}

export function createDefaultDesign(booking: Pick<Booking, 'coupleNames'>, now = new Date()): DesignState {
  const holding = defaultHoldingDesign(booking);
  return {
    version: 1,
    status: 'draft',
    updatedAt: now.toISOString(),
    submittedAt: null,
    separatePostBridal: false,
    holding: { pre: holding, post: structuredClone(holding) },
    reactions: { pre: [], post: [] },
    media: [],
    invite: null,
    stylingNote: '',
    liveContentRequested: false,
  };
}

/** When the post bridal toggle is off, one design is used for both phases. */
export function holdingFor(design: DesignState, phase: Phase): HoldingDesign {
  return phase === 'post' && design.separatePostBridal ? design.holding.post : design.holding.pre;
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
