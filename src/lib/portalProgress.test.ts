import { describe, expect, it } from 'vitest';
import { stepsFor } from '../design/steps';
import type { DesignState } from '../types';
import { confirmOnLeave, confirmStep, createDefaultDesign, recordStepChoice } from './design';
import { screenCount } from './dimensions';
import { floorDesignLabel, portalStepReport, portalSummary } from './portalProgress';

const booking = { coupleNames: 'Sam & Alex' };

function design(patch: Partial<DesignState> = {}): DesignState {
  return { ...createDefaultDesign(booking, new Date('2026-04-01T00:00:00.000Z')), ...patch };
}

function applicableNames(screens: number | null, reactions: string[] = []): string[] {
  return stepsFor(screenCount(screens), reactions.length === 0).map((step) => step.name);
}

describe('portal step progress', () => {
  it('gives a fresh design 0% and lists every applicable step as missing', () => {
    const fresh = design();
    const withScreens = portalStepReport(fresh, 2);
    const noScreens = portalStepReport(fresh, 0);
    const unknownScreens = portalStepReport(fresh, null);

    expect(withScreens.progress).toBe(0);
    expect(withScreens.complete).toBe(0);
    expect(withScreens.missing).toEqual(applicableNames(2));
    expect(withScreens.missing).toContain('Your screen design');
    expect(withScreens.missing).toContain('Screens before the entrance');
    expect(withScreens.missing).toContain('Your holding screen');
    expect(withScreens.missing).toContain('Review and submit');
    expect(noScreens.progress).toBe(0);
    expect(noScreens.missing).toEqual(applicableNames(0));
    expect(noScreens.missing).not.toContain('Your screen design');
    expect(noScreens.missing).not.toContain('Screens before the entrance');
    expect(noScreens.missing).not.toContain('Screens after the entrance');
    expect(noScreens.missing).not.toContain('Screens during the dancing');
    expect(unknownScreens).toEqual(noScreens);
    expect(noScreens.total).toBeLessThan(withScreens.total);
    expect(withScreens.complete + withScreens.missing.length).toBe(withScreens.total);
  });

  it('counts a default only after that step is confirmed', () => {
    const fresh = portalStepReport(design(), 0);
    expect(fresh.missing).toContain('Reactions before the entrance');
    expect(fresh.missing).toContain('After the bridal entrance');
    expect(fresh.missing).toContain('Dancing time');
    expect(fresh.missing).toContain('Your holding screen');

    const confirmed = design({ confirmedSteps: ['floor-reactions', 'floor-after', 'floor-dancing'] });
    const report = portalStepReport(confirmed, 0);
    expect(report.missing).not.toContain('Reactions before the entrance');
    expect(report.missing).not.toContain('After the bridal entrance');
    expect(report.missing).not.toContain('Dancing time');
    expect(report.missing).toContain('Your holding screen');
    expect(report.progress).toBeGreaterThan(0);
    expect(report.progress).toBeLessThan(1);

    const lookedAtHolding = design({ confirmedSteps: ['floor-design'] });
    expect(portalStepReport(lookedAtHolding, 0).missing).toContain('Your holding screen');

    const styled = design({
      confirmedSteps: ['floor-design'],
      designs: {
        ...design().designs,
        holding: { styleId: 'gold-rings', names: 'Sam & Alex', media: null },
      },
    });
    expect(portalStepReport(styled, 0).missing).not.toContain('Your holding screen');

    const needsNote = design({ confirmedSteps: ['floor-dancing'], dancingMode: 'different', dancingNote: '' });
    expect(portalStepReport(needsNote, 0).missing).toContain('Dancing time');
  });

  it('does not confirm a step when the couple goes back', () => {
    const steps = stepsFor(2, true);
    const start = design();
    const forward = confirmOnLeave(start, 'details', 'floor-design', steps);
    expect(forward.confirmedSteps).toEqual(['details']);

    const back = confirmOnLeave(forward, 'floor-design', 'details', steps);
    expect(back).toBe(forward);
    expect(back.confirmedSteps).toEqual(['details']);

    const skipped = confirmOnLeave(start, 'floor-design', 'review', steps);
    expect(skipped.confirmedSteps).toEqual(['floor-design']);
    expect(confirmOnLeave(start, 'details', 'details', steps)).toBe(start);
  });

  it('confirms the step when a choice on it changes', () => {
    const start = design({ status: 'submitted' });
    const changed = recordStepChoice(start, 'floor-dancing', (current) => ({ ...current, dancingMode: 'videos' }));
    expect(changed.dancingMode).toBe('videos');
    expect(changed.confirmedSteps).toEqual(['floor-dancing']);
    expect(changed.status).toBe('submitted');

    const again = recordStepChoice(changed, 'floor-dancing', (current) => ({ ...current, dancingNote: 'Gold light' }));
    expect(again.confirmedSteps).toEqual(['floor-dancing']);
    expect(again.dancingNote).toBe('Gold light');

    const moved = confirmStep(start, 'details', '2026-04-02T00:00:00.000Z');
    expect(moved.status).toBe('submitted');
    expect(moved.confirmedSteps).toEqual(['details']);
    expect(confirmStep(moved, 'details', '2026-04-03T00:00:00.000Z')).toBe(moved);
  });

  it('gives a submitted design 100%', () => {
    const base = design();
    const steps = stepsFor(0, false);
    const done = design({
      confirmedSteps: steps.map((step) => step.id),
      designs: {
        ...base.designs,
        holding: { styleId: 'gold-rings', names: 'Sam & Alex', media: null },
      },
      reactions: ['koi-pond'],
      status: 'submitted',
    });
    const finished = portalStepReport(done, 0);
    expect(finished.missing).toEqual([]);
    expect(finished.progress).toBe(1);
    expect(finished.complete).toBe(finished.total);
  });

  it('leaves hidden screen steps out of the total', () => {
    const base = design();
    const withScreenSteps = stepsFor(2, false);
    const done = design({
      confirmedSteps: withScreenSteps.map((step) => step.id),
      designs: {
        ...base.designs,
        holding: { styleId: 'gold-rings', names: 'Sam & Alex', media: null },
      },
      reactions: ['koi-pond'],
      screens: { styleId: 'cherry-blossom', note: '', modes: { holding: 'design', after: 'design', dancing: 'design' } },
      status: 'submitted',
    });
    const screens = portalStepReport(done, 2);
    const hidden = portalStepReport(done, 0);
    expect(screens.progress).toBe(1);
    expect(screens.missing).toEqual([]);
    expect(hidden.progress).toBe(1);
    expect(hidden.total).toBeLessThan(screens.total);
    expect(hidden.missing).not.toContain('Your screen design');
    expect(hidden.missing).not.toContain('Screens before the entrance');
    expect(hidden.missing).not.toContain('Screens after the entrance');
    expect(hidden.missing).not.toContain('Screens during the dancing');

    const freshHidden = portalStepReport(design(), 0);
    expect(freshHidden.progress).toBe(0);
    expect(freshHidden.missing).not.toContain('Your screen design');
  });

  it('says when a step has not been looked at, and when a default was kept', () => {
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
    expect(summary).toContain('Holding screen: Not looked at yet');
    expect(summary).toContain('Dancing time: Not looked at yet');
    expect(summary).toContain('Floor design: Gold rings, photo uploaded.');
    expect(summary).not.toContain('{');
    expect(summary).not.toContain('styleId');
    expect(floorDesignLabel(ready)).not.toContain('Not looked at yet');
    expect(floorDesignLabel(ready)).not.toContain('Default kept');
    expect(floorDesignLabel(design())).toContain('not set yet');
    expect(floorDesignLabel(design()).includes('\n')).toBe(false);

    const kept = portalSummary(design({ confirmedSteps: ['floor-dancing', 'floor-reactions'] }), 0);
    expect(kept).toContain('Dancing time: Default kept');
    expect(kept).toContain('Reactions: Default kept');
    expect(kept).toContain('Holding screen: Not looked at yet');

    const chosen = portalSummary(
      design({
        confirmedSteps: ['floor-design'],
        designs: ready.designs,
      }),
      0,
    );
    expect(chosen).toContain('Holding screen: Gold rings, photo uploaded');

    const unset = portalSummary(design({ confirmedSteps: ['floor-dancing'], dancingMode: 'different', dancingNote: '' }), 0);
    expect(unset).toContain('Dancing time: not set yet');
    expect(unset).toContain('Holding screen: Not looked at yet');
  });
});
