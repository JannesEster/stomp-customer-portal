import { describe, expect, it } from 'vitest';
import { createDefaultDesign } from './design';
import { floorDesignLabel, portalStepReport, portalSummary } from './portalProgress';
import type { DesignState } from '../types';

const booking = { coupleNames: 'Sam & Alex' };

function design(patch: Partial<DesignState> = {}): DesignState {
  return { ...createDefaultDesign(booking, new Date('2026-04-01T00:00:00.000Z')), ...patch };
}

describe('portal step progress', () => {
  it('hides screen steps when none are booked and names the steps that are still open', () => {
    const fresh = design();
    const withScreens = portalStepReport(fresh, 2);
    const noScreens = portalStepReport(fresh, 0);
    const unknownScreens = portalStepReport(fresh, null);

    expect(withScreens.missing).toContain('Your screen design');
    expect(withScreens.missing).toContain('Screens before the entrance');
    expect(withScreens.missing).toContain('Your holding screen');
    expect(withScreens.missing).toContain('Review and submit');
    expect(noScreens.missing).not.toContain('Your screen design');
    expect(noScreens.missing).not.toContain('Screens before the entrance');
    expect(noScreens.missing).not.toContain('Screens after the entrance');
    expect(noScreens.missing).not.toContain('Screens during the dancing');
    expect(unknownScreens).toEqual(noScreens);
    expect(noScreens.total).toBeLessThan(withScreens.total);
    expect(withScreens.progress).toBe(Math.round((withScreens.complete / withScreens.total) * 10000) / 10000);
    expect(withScreens.progress).toBeGreaterThan(0);
    expect(withScreens.progress).toBeLessThan(1);
    expect(withScreens.complete + withScreens.missing.length).toBe(withScreens.total);
  });

  it('counts a finished floor and leaves dancing time missing until the note is written', () => {
    const ready = design({
      designs: {
        ...design().designs,
        holding: {
          styleId: 'gold-rings',
          names: 'Sam & Alex',
          media: { id: 'filefake00000001', name: 'hands.jpg', type: 'image/jpeg', size: 10 },
        },
      },
      dancingMode: 'different',
      dancingNote: '',
      screens: { styleId: 'cherry-blossom', modes: { holding: 'design', after: 'design', dancing: 'photos' } },
    });
    const screens = portalStepReport(ready, 2);
    expect(screens.missing).toContain('Dancing time');
    expect(screens.missing).toContain('Screens during the dancing');
    expect(screens.missing).not.toContain('Your holding screen');
    expect(screens.missing).not.toContain('Your screen design');

    const done = design({
      ...ready,
      dancingNote: 'Soft gold light',
      screens: { styleId: 'cherry-blossom', modes: { holding: 'design', after: 'design', dancing: 'design' } },
      status: 'submitted',
    });
    const finished = portalStepReport(done, 0);
    expect(finished.missing).toEqual([]);
    expect(finished.progress).toBe(1);
  });

  it('writes a plain summary and a single line floor design name', () => {
    const ready = design({
      designs: {
        ...design().designs,
        holding: {
          styleId: 'gold-rings',
          names: 'Sam & Alex',
          media: { id: 'filefake00000001', name: 'hands.jpg', type: 'image/jpeg', size: 10 },
        },
      },
    });
    const summary = portalSummary(ready, 0);
    expect(summary).toContain('Holding screen: Gold rings, photo uploaded');
    expect(summary).toContain('Dancing time: Blank floor with assorted reactions');
    expect(summary).toContain('Floor design: Gold rings, photo uploaded.');
    expect(summary).not.toContain('{');
    expect(summary).not.toContain('styleId');
    expect(summary.split('\n').every((line) => !line.includes('\n'))).toBe(true);

    const unset = portalSummary(design({ dancingMode: 'different', dancingNote: '' }), 0);
    expect(unset).toContain('Holding screen: not set yet');
    expect(unset).toContain('Dancing time: not set yet');
    expect(floorDesignLabel(ready).includes('\n')).toBe(false);
    expect(floorDesignLabel(design())).toContain('not set yet');
  });
});
