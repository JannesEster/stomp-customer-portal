import { describe, expect, it } from 'vitest';
import {
  DESIGN_VERSION,
  createDefaultDesign,
  holdingFor,
  mediaFor,
  mediaKindOf,
  reactionsFor,
  showsDancingVideos,
  timingFor,
  usableDesign,
  validateUpload,
} from './design';
import { dancingVideosConfig, effectsConfig, holdingStylesConfig, portalConfig, screenStylesConfig } from '../config';
import type { DesignState, MediaItem, Phase, Timing } from '../types';

const booking = { coupleNames: 'Sam & Alex' };

describe('holdingFor', () => {
  it('keeps the holding screen after the entrance and goes blank for dancing time by default', () => {
    const d = createDefaultDesign(booking);
    expect(d).toMatchObject({ afterMode: 'same', dancingMode: 'blank' });
    expect(holdingFor(d, 'holding')).toBe(d.designs.holding);
    expect(holdingFor(d, 'after')).toBe(d.designs.holding);
    expect(holdingFor(d, 'dancing')).toBeNull();
  });

  it('moves a saved blank floor after the entrance to keeping the holding screen', () => {
    const saved = { ...createDefaultDesign(booking), afterMode: 'blank' } as unknown as DesignState;
    expect(usableDesign(saved, booking).afterMode).toBe('same');
  });

  it('uses each phase design when a different style is chosen', () => {
    const d: DesignState = { ...createDefaultDesign(booking), afterMode: 'different', dancingMode: 'different' };
    expect(holdingFor(d, 'after')).toBe(d.designs.after);
    expect(holdingFor(d, 'dancing')).toBe(d.designs.dancing);
  });

  it('defaults names to the couple on the booking, with no style or photo', () => {
    expect(createDefaultDesign(booking).designs.holding).toEqual({ styleId: null, names: 'Sam & Alex', media: null });
  });
});

describe('reactionsFor', () => {
  it('uses the holding screen picks before dancing time', () => {
    const d: DesignState = { ...createDefaultDesign(booking), reactions: ['fantasy-lightning'] };
    expect(reactionsFor(d, 'holding')).toEqual({ ids: ['fantasy-lightning'], assorted: false });
    expect(reactionsFor(d, 'after')).toEqual({ ids: ['fantasy-lightning'], assorted: false });
  });

  it('uses every effect, assorted, for dancing time', () => {
    const d: DesignState = { ...createDefaultDesign(booking), reactions: ['fantasy-lightning'] };
    expect(reactionsFor(d, 'dancing')).toEqual({ ids: effectsConfig.effects.map((e) => e.id), assorted: true });
  });

  it('has no reactions and no design while the colourful videos play', () => {
    const d: DesignState = { ...createDefaultDesign(booking), dancingMode: 'videos' };
    expect(reactionsFor(d, 'dancing')).toEqual({ ids: [], assorted: false });
    expect(holdingFor(d, 'dancing')).toBeNull();
    expect(showsDancingVideos(d, 'dancing')).toBe(true);
    expect(showsDancingVideos(d, 'holding')).toBe(false);
  });
});

describe('usableDesign', () => {
  it('keeps a current design and fills in fields added since it was saved', () => {
    const current: DesignState = { ...createDefaultDesign(booking), reactions: ['fantasy-bubbles'] };
    expect(usableDesign(current, booking)).toEqual(current);
    const { invitePalette: _dropped, ...withoutPalette } = current;
    expect(usableDesign(withoutPalette as DesignState, booking).invitePalette).toEqual([]);
  });

  it('drops reactions that are no longer offered', () => {
    const saved: DesignState = { ...createDefaultDesign(booking), reactions: ['hearts', 'koi-pond', 'twinkles'] };
    expect(usableDesign(saved, booking).reactions).toEqual(['koi-pond']);
  });

  it('replaces a design saved by an older version', () => {
    const current = createDefaultDesign(booking);
    const old = { ...current, version: 2 } as unknown as DesignState;
    expect(usableDesign(old, booking)).not.toBe(old);
    expect(usableDesign(null, booking).version).toBe(DESIGN_VERSION);
  });

  it('gives a design saved before the screens plan the screen design for every part of the night', () => {
    const { screens: _dropped, ...saved } = { ...createDefaultDesign(booking), reactions: ['fantasy-bubbles'] };
    const usable = usableDesign(saved as DesignState, booking);
    expect(usable.screens).toEqual({ styleId: null, modes: { holding: 'design', after: 'design', dancing: 'design' } });
    expect(usable.reactions).toEqual(['fantasy-bubbles']);
  });
});

describe('screen photos and videos', () => {
  const item = (id: string, timing: Timing): MediaItem => ({
    id,
    file: { id: `file-${id}`, name: `${id}.jpg`, type: 'image/jpeg', size: 1 },
    kind: 'image',
    timing,
    addedAt: '2026-01-01T00:00:00.000Z',
  });

  it('maps each part of the night to the timing saved with its media', () => {
    expect(timingFor('holding')).toBe('start');
    expect(timingFor('after')).toBe('middle');
    expect(timingFor('dancing')).toBe('end');
  });

  it('has a timing label for every part of the night', () => {
    for (const p of ['holding', 'after', 'dancing'] as Phase[]) {
      expect(portalConfig.timings.some((t) => t.id === timingFor(p)), p).toBe(true);
    }
  });

  it('finds saved media for its part of the night, in the order it was added', () => {
    const d: DesignState = {
      ...createDefaultDesign(booking),
      media: [item('a', 'start'), item('b', 'end'), item('c', 'start')],
    };
    expect(mediaFor(d, 'holding').map((m) => m.id)).toEqual(['a', 'c']);
    expect(mediaFor(d, 'after')).toEqual([]);
    expect(mediaFor(d, 'dancing').map((m) => m.id)).toEqual(['b']);
  });
});

describe('media files named in config', () => {
  const files = new Set(Object.keys(import.meta.glob('/public/**/*.{mp4,jpg,svg}')));
  const exists = (src: string) => files.has(`/public${src}`);

  it('has every holding style video and poster', () => {
    for (const s of holdingStylesConfig.styles) {
      for (const src of [s.video, s.sampleVideo, s.poster]) expect(exists(src), src).toBe(true);
    }
  });

  it('has every reaction recording and poster, with unique ids and the popular ones first', () => {
    const ids = effectsConfig.effects.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of effectsConfig.effects) {
      expect(exists(e.video), e.video).toBe(true);
      expect(exists(e.poster), e.poster).toBe(true);
    }
    const firstOther = effectsConfig.effects.findIndex((e) => !e.popular);
    expect(effectsConfig.effects.slice(firstOther).some((e) => e.popular)).toBe(false);
  });

  it('has every dancing video and poster, with unique ids', () => {
    const ids = dancingVideosConfig.videos.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const v of dancingVideosConfig.videos) {
      expect(exists(v.src), v.src).toBe(true);
      expect(exists(v.poster), v.poster).toBe(true);
    }
  });

  it('has every screen design image, with unique ids and a known kind', () => {
    const ids = screenStylesConfig.styles.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of screenStylesConfig.styles) {
      expect(exists(s.image), s.image).toBe(true);
      expect(['welcome', 'schedule']).toContain(s.kind);
    }
  });
});

describe('holding styles config', () => {
  it('has unique ids and a video and poster for every style', () => {
    const ids = holdingStylesConfig.styles.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of holdingStylesConfig.styles) {
      expect(s.video).toMatch(/\.mp4$/);
      expect(s.poster).toMatch(/\.jpg$/);
    }
  });
});

describe('validateUpload', () => {
  const rule = { accept: ['image/jpeg', 'video/mp4'], maxImageMb: 1, maxVideoMb: 10 };
  const mb = 1024 * 1024;

  it('accepts allowed types within their limits', () => {
    expect(validateUpload({ name: 'a.jpg', type: 'image/jpeg', size: mb / 2 }, rule)).toBeNull();
    expect(validateUpload({ name: 'b.mp4', type: 'video/mp4', size: 5 * mb }, rule)).toBeNull();
  });

  it('rejects other types', () => {
    expect(validateUpload({ name: 'c.gif', type: 'image/gif', size: 10 }, rule)).toMatch(/supported/);
  });

  it('applies the image and video limits separately', () => {
    expect(validateUpload({ name: 'a.jpg', type: 'image/jpeg', size: 2 * mb }, rule)).toMatch(/1 MB/);
    expect(validateUpload({ name: 'b.mp4', type: 'video/mp4', size: 11 * mb }, rule)).toMatch(/10 MB/);
  });

  it('falls back to maxMb', () => {
    const doc = { accept: ['application/pdf'], maxMb: 2 };
    expect(validateUpload({ name: 'i.pdf', type: 'application/pdf', size: 3 * mb }, doc)).toMatch(/2 MB/);
  });
});

describe('mediaKindOf', () => {
  it('detects images and videos', () => {
    expect(mediaKindOf('image/png')).toBe('image');
    expect(mediaKindOf('video/mp4')).toBe('video');
    expect(mediaKindOf('application/pdf')).toBeNull();
  });
});
