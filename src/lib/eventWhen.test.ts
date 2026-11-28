import { describe, expect, it } from 'vitest';
import { countdownLabel, daysUntilEvent, eventCalendar } from './eventWhen';

describe('event countdown', () => {
  const now = new Date('2026-11-28T02:00:00.000Z');

  it('counts whole days in Perth and says when the date has passed', () => {
    expect(daysUntilEvent('2026-12-02', now)).toBe(4);
    expect(countdownLabel('2026-12-02', now)).toBe('4 days to go');
    expect(countdownLabel('2026-11-29', now)).toBe('1 day to go');
    expect(countdownLabel('2026-11-28', now)).toBe('0 days to go');
    expect(countdownLabel('2026-11-01', now)).toBe('This event date has passed');
    expect(countdownLabel('')).toBeNull();
  });

  it('builds an all day calendar file without a staff link', () => {
    const ics = eventCalendar({
      id: 'bk-1001',
      coupleNames: 'Sam & Alex',
      eventDate: '2027-03-13',
      venue: 'Demo Estate',
      address: 'Swan Valley',
    });
    expect(ics).toContain('DTSTART;VALUE=DATE:20270313');
    expect(ics).toContain('SUMMARY:Stomp Sphere\\, Sam & Alex');
    expect(ics).toContain('LOCATION:Demo Estate\\, Swan Valley');
    expect(ics).not.toContain('go.xero.com');
    expect(ics).not.toMatch(/[—–]/);
  });
});
