import { describe, expect, it } from 'vitest';
import { createDefaultDesign } from './design';
import { sanitizePortalAnswers } from './portalAnswers';

const names = 'Fake Customer';

function posted() {
  return createDefaultDesign({ coupleNames: names }, new Date('2026-04-01T00:00:00.000Z'));
}

describe('sanitizePortalAnswers', () => {
  it('strips unknown keys and caps strings and arrays', () => {
    const design = posted();
    design.designs.holding.names = 'N'.repeat(500);
    design.reactions = Array.from({ length: 50 }, () => 'koi-pond');
    const result = sanitizePortalAnswers(
      { ...design, secretNote: 'LEAK-ME', 'Important notes': 'LEAK-ME' },
      names,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.design.designs.holding.names).toHaveLength(120);
    expect(result.design.reactions).toHaveLength(40);
    const json = JSON.stringify(result.design);
    expect(json).not.toContain('secretNote');
    expect(json).not.toContain('LEAK-ME');
    expect(json).not.toContain('Important notes');
  });

  it('drops unknown step ids and keeps each known id once', () => {
    const result = sanitizePortalAnswers(
      { ...posted(), confirmedSteps: ['details', 'not-a-step', 'details', 'review', 'secret'] },
      names,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.design.confirmedSteps).toEqual(['details', 'review']);
  });

  it('keeps supplier names and screen wording, and fills them when an older save has none', () => {
    const result = sanitizePortalAnswers(
      {
        ...posted(),
        weddingPlanner: 'Ada Planner',
        otherSuppliers: 'Celebrant: Jo',
        screens: { ...posted().screens, note: 'A food menu' },
      },
      names,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.design.weddingPlanner).toBe('Ada Planner');
    expect(result.design.otherSuppliers).toBe('Celebrant: Jo');
    expect(result.design.screens.note).toBe('A food menu');

    const { weddingPlanner: _w, photographer: _p, videographer: _v, dj: _d, otherSuppliers: _o, ...saved } = posted();
    const older = sanitizePortalAnswers(saved, names);
    expect(older.ok).toBe(true);
    if (!older.ok) return;
    expect(older.design.weddingPlanner).toBe('');
    expect(older.design.screens.note).toBe('');
  });

  it('parses older answers without confirmed steps as an empty list', () => {
    const { confirmedSteps: _dropped, ...saved } = posted();
    const result = sanitizePortalAnswers(saved, names);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.design.confirmedSteps).toEqual([]);
    expect(sanitizePortalAnswers({ ...posted(), confirmedSteps: 'details' }, names).ok).toBe(false);
  });

  it('rejects a design that is the wrong shape', () => {
    expect(sanitizePortalAnswers(null, names).ok).toBe(false);
    expect(sanitizePortalAnswers({ version: 2 }, names).ok).toBe(false);
    expect(sanitizePortalAnswers({ ...posted(), reactions: 'nope' }, names).ok).toBe(false);
    expect(sanitizePortalAnswers({ ...posted(), status: 'published' }, names).ok).toBe(false);
    expect(sanitizePortalAnswers({ ...posted(), screens: { styleId: null, modes: { holding: 'nope' } } }, names).ok).toBe(
      false,
    );
  });
});
