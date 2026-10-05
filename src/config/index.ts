import portalJson from './portal.json';
import effectsJson from './effects.json';
import holdingStylesJson from './holding-styles.json';
import dancingVideosJson from './dancing-videos.json';
import extrasJson from './extras.json';
import type { Timing } from '../types';

export interface FloorConfig {
  tileSizeMm: number;
  tilePx: number;
}

export interface ScreenConfig {
  widthPx: number;
  heightPx: number;
  maxScreens: number;
  slideSeconds: number;
}

export interface UploadRule {
  accept: string[];
  maxMb?: number;
  maxImageMb?: number;
  maxVideoMb?: number;
}

export interface PortalConfig {
  floor: FloorConfig;
  screen: ScreenConfig;
  timings: { id: Timing; label: string }[];
  uploads: { media: UploadRule; holdingMedia: UploadRule; invite: UploadRule };
}

/**
 * A floor reaction. `video` is a recording of the real effect on Stomp's floor with
 * someone walking across it, on black so it can play over a holding screen.
 */
export interface EffectDef {
  id: string;
  name: string;
  description: string;
  video: string;
  poster: string;
  /** The fantasy reactions, listed first as the most popular */
  popular?: boolean;
  /** Brings its own scene, so it covers the holding screen while it plays */
  fillsFloor?: boolean;
  /** The floor program it comes from, numbered as in Stomp's U3D folder */
  program: string;
}

export interface EffectsConfig {
  effects: EffectDef[];
}

/** Positions are fractions of the style's video frame. Sizes are fractions of its height. */
export interface TextSlotDef {
  x: number;
  y: number;
  size: number;
  /** Key into the fonts map in holding-styles.json */
  font: string;
  weight?: number;
  italic?: boolean;
  colour: string;
  maxWidth: number;
  uppercase?: boolean;
  /** In ems */
  letterSpacing?: number;
  /** Degrees, around the slot's centre */
  rotate?: number;
  /** A soft dark glow behind the text, for busy photo backgrounds */
  shadow?: boolean;
}

export interface NamesSlotDef extends TextSlotDef {
  /** line: "Sam & Alex". stacked: Sam / & / Alex. twoLines: "Sam &" / "Alex". initials: "S & A". firstInitial and secondInitial: one big letter. */
  layout: 'line' | 'stacked' | 'twoLines' | 'initials' | 'firstInitial' | 'secondInitial';
  lineHeight?: number;
  connector?: string;
  connectorFont?: string;
  connectorSize?: number;
  /** Added after the last name, for styles like "Sam & Alex's wedding" */
  suffix?: string;
}

export interface DateSlotDef extends TextSlotDef {
  /** Tokens: D, DD, M, MM, MMMM, YYYY. For example "D MMMM YYYY" or "DD.MM.YYYY". */
  format: string;
}

export interface FixedTextDef extends TextSlotDef {
  text: string;
}

export interface LiveTextDef {
  names: NamesSlotDef;
  /** Filled in from the booking's event date */
  date?: DateSlotDef;
  /** Wording that is part of the style but was removed from the video with the names */
  fixed?: FixedTextDef[];
}

/**
 * A holding screen style. `video` has no names or date, which are drawn live
 * over it; `sampleVideo` and `poster` show the style with example names.
 */
export interface HoldingStyleDef {
  id: string;
  name: string;
  description: string;
  video: string;
  sampleVideo: string;
  poster: string;
  usesPhoto: boolean;
  live: LiveTextDef;
}

export interface HoldingStylesConfig {
  fonts: Record<string, string>;
  styles: HoldingStyleDef[];
}

/** A colourful visual for dancing time. The files in public/dancing are short previews of Stomp's full loops. */
export interface DancingVideoDef {
  id: string;
  name: string;
  src: string;
  poster: string;
}

export interface DancingVideosConfig {
  /** The preview moves to the next video this often */
  rotateSeconds: number;
  videos: DancingVideoDef[];
}

export interface ExtraDef {
  id: string;
  name: string;
  priceAud: number;
  description: string;
}

export interface ExtrasConfig {
  currency: string;
  liveContentExtraId: string;
  extras: ExtraDef[];
}

/** Media paths in the config start at the site root, but the site can be served from a subfolder. */
export function fromRoot(path: string): string {
  return path.startsWith('/') ? import.meta.env.BASE_URL + path.slice(1) : path;
}

const effects = effectsJson as EffectsConfig;
const holdingStyles = holdingStylesJson as HoldingStylesConfig;
const dancingVideos = dancingVideosJson as DancingVideosConfig;

export const portalConfig = portalJson as PortalConfig;
export const effectsConfig: EffectsConfig = {
  ...effects,
  effects: effects.effects.map((e) => ({ ...e, video: fromRoot(e.video), poster: fromRoot(e.poster) })),
};
export const holdingStylesConfig: HoldingStylesConfig = {
  ...holdingStyles,
  styles: holdingStyles.styles.map((s) => ({
    ...s,
    video: fromRoot(s.video),
    sampleVideo: fromRoot(s.sampleVideo),
    poster: fromRoot(s.poster),
  })),
};
export const dancingVideosConfig: DancingVideosConfig = {
  ...dancingVideos,
  videos: dancingVideos.videos.map((v) => ({ ...v, src: fromRoot(v.src), poster: fromRoot(v.poster) })),
};
export const extrasConfig = extrasJson as ExtrasConfig;

export function findStyle(id: string | null): HoldingStyleDef | undefined {
  return id ? holdingStylesConfig.styles.find((s) => s.id === id) : undefined;
}

export function findEffect(id: string): EffectDef | undefined {
  return effectsConfig.effects.find((e) => e.id === id);
}

export function timingLabel(id: Timing): string {
  return portalConfig.timings.find((t) => t.id === id)?.label ?? id;
}
