import { describe, expect, it } from 'vitest';
import { createDefaultDesign } from '../lib/design';
import { floorPreviewHash, shouldUploadFloorPreview, visiblePreviewFailure } from './floorPreviewSync';

describe('floor preview upload decisions', () => {
  it('uploads when the floor inputs change, and again on submit', () => {
    const design = createDefaultDesign({ coupleNames: 'Sam & Alex' });
    const same = floorPreviewHash(design);
    expect(floorPreviewHash({ ...design })).toBe(same);
    expect(shouldUploadFloorPreview(same, same, 'change')).toBe(false);
    expect(shouldUploadFloorPreview(same, same, 'submit')).toBe(true);
    expect(shouldUploadFloorPreview(null, same, 'change')).toBe(true);

    const next = floorPreviewHash({
      ...design,
      designs: { ...design.designs, holding: { ...design.designs.holding, styleId: 'gold-rings' } },
    });
    expect(next).not.toBe(same);
    expect(shouldUploadFloorPreview(same, next, 'change')).toBe(true);
  });

  it('turns a preview_failed error into a message the couple can see', () => {
    const message = visiblePreviewFailure(new Error('preview_failed'));
    expect(message.length).toBeGreaterThan(0);
    expect(message).not.toBe('preview_failed');
    expect(message).not.toMatch(/ - /);
    expect(message).not.toMatch(/[—–]/);
  });
});
