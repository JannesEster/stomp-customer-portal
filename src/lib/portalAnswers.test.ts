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
