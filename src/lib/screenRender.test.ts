import { describe, expect, it } from 'vitest';
import { screenStylesConfig } from '../config';
import { requestBand, screenCopy } from './screenRender';

describe('screen wording', () => {
  const live = screenStylesConfig.styles[0].live;

  it('keeps the template wording until the couple writes their own', () => {
    expect(screenCopy(live, '')).toBe(live);
    expect(screenCopy(live, '   ').fixed).toEqual(live.fixed);
  });

  it('drops the template wording when the couple specifies something else, and keeps their name and date slots', () => {
    const copy = screenCopy(live, 'A food menu');
    expect(copy.fixed).toBeUndefined();
    expect(copy.names).toBe(live.names);
    expect(copy.date).toBe(live.date);
  });

  it('puts their own wording where the template wording was, clear of the names', () => {
    const welcome = requestBand(live, 'welcome');
    expect(welcome.bottom).toBeLessThan(live.names.y);
    const schedule = screenStylesConfig.styles.find((s) => s.kind === 'schedule')!.live;
    const band = requestBand(schedule, 'schedule');
    expect(band.y).toBeGreaterThan(Math.min(schedule.names.y, schedule.date!.y));
    expect(band.bottom).toBeLessThan(Math.max(schedule.names.y, schedule.date!.y));
  });
});
