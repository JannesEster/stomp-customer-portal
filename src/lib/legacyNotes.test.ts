import { describe, expect, it } from 'vitest';
import { createDefaultDesign } from './design';
import { migrateLegacyNotes } from './legacyNotes';

const design = () => createDefaultDesign({ coupleNames: 'Sam & Alex' }, new Date('2026-04-01T00:00:00.000Z'));

describe('legacy notes', () => {
  it('copies browser notes when the server notes are empty', () => {
    const result = migrateLegacyNotes(design(), 'Gate code is on the fridge', '');
    expect(result.migrated).toBe(true);
    expect(result.design.notes).toBe('Gate code is on the fridge');
  });

  it('leaves server notes and existing design notes untouched', () => {
    expect(migrateLegacyNotes(design(), 'old', 'already saved').migrated).toBe(false);
    const kept = design();
    kept.notes = 'typed here';
    expect(migrateLegacyNotes(kept, 'old', '').migrated).toBe(false);
    expect(migrateLegacyNotes(design(), '   ', '').migrated).toBe(false);
  });
});
