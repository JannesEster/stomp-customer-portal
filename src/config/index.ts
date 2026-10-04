import portalJson from './portal.json';
import effectsJson from './effects.json';
import templatesJson from './templates.json';
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
  uploads: { media: UploadRule; holdingPhoto: UploadRule; invite: UploadRule };
}

export type EffectAnimation = 'float' | 'spin' | 'burst' | 'twinkle';

export interface EffectDef {
  id: string;
  name: string;
  description: string;
  preview: { type: 'image' | 'video'; src: string };
  animation: EffectAnimation;
  count: number;
}

export interface EffectsConfig {
  sizeTiles: number;
  durationMs: number;
  effects: EffectDef[];
}

export type PhotoShape = 'circle' | 'arch' | 'rect' | 'full';

export interface TextSlot {
  x: number;
  y: number;
  size: number;
  maxWidth: number;
  align: CanvasTextAlign;
}

export interface TemplateDef {
  id: string;
  name: string;
  background: 'solid' | 'glow' | 'photo';
  border: boolean;
  photo: { shape: PhotoShape; x: number; y: number; w: number; h: number } | null;
  names: TextSlot;
  secondLine: TextSlot;
}

export interface FontDef {
  id: string;
  label: string;
  css: string;
}

export interface TemplatesConfig {
  defaults: {
    templateId: string;
    fontId: string;
    textColour: string;
    backgroundColour: string;
    accentColour: string;
  };
  fonts: FontDef[];
  templates: TemplateDef[];
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

export const portalConfig = portalJson as PortalConfig;
export const effectsConfig = effectsJson as EffectsConfig;
export const templatesConfig = templatesJson as TemplatesConfig;
export const extrasConfig = extrasJson as ExtrasConfig;

export function findTemplate(id: string): TemplateDef {
  return templatesConfig.templates.find((t) => t.id === id) ?? templatesConfig.templates[0];
}

export function findFont(id: string): FontDef {
  return templatesConfig.fonts.find((f) => f.id === id) ?? templatesConfig.fonts[0];
}

export function findEffect(id: string): EffectDef | undefined {
  return effectsConfig.effects.find((e) => e.id === id);
}

export function timingLabel(id: Timing): string {
  return portalConfig.timings.find((t) => t.id === id)?.label ?? id;
}
