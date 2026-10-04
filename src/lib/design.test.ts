import { describe, expect, it } from 'vitest';
import { createDefaultDesign, holdingFor, mediaKindOf, validateUpload } from './design';

describe('holdingFor', () => {
  it('uses the pre bridal design for both phases when the toggle is off', () => {
    const d = createDefaultDesign({ coupleNames: 'Sam & Alex' });
    d.holding.post.names = 'Different';
    expect(holdingFor(d, 'post')).toBe(d.holding.pre);
  });

  it('uses the post bridal design when the toggle is on', () => {
    const d = createDefaultDesign({ coupleNames: 'Sam & Alex' });
    d.separatePostBridal = true;
    expect(holdingFor(d, 'post')).toBe(d.holding.post);
    expect(holdingFor(d, 'pre')).toBe(d.holding.pre);
  });

  it('defaults names to the couple on the booking', () => {
    expect(createDefaultDesign({ coupleNames: 'Sam & Alex' }).holding.pre.names).toBe('Sam & Alex');
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
