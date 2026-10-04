import { describe, expect, it } from 'vitest';
import { liveContentView } from './liveContent';
import type { ExtrasConfig } from '../config';

describe('liveContentView', () => {
  it('booked: ticked, locked, included, no price in the label', () => {
    const v = liveContentView({ extras: ['live-event-streaming'] }, false);
    expect(v).toMatchObject({ included: true, checked: true, locked: true });
    expect(v.label).toBe('Live event streaming, included in your booking');
    expect(v.label).not.toContain('$');
  });

  it('booked: stays ticked even if no request was recorded', () => {
    expect(liveContentView({ extras: ['live-event-streaming'] }, false).checked).toBe(true);
  });

  it('not booked: optional $500 extra that follows the request', () => {
    const off = liveContentView({ extras: [] }, false);
    expect(off).toMatchObject({ included: false, checked: false, locked: false, priceAud: 500 });
    expect(off.label).toBe('Live event streaming, $500 extra');
    expect(liveContentView({ extras: [] }, true).checked).toBe(true);
  });

  it('price comes from config', () => {
    const config: ExtrasConfig = {
      currency: 'AUD',
      liveContentExtraId: 'live-event-streaming',
      extras: [{ id: 'live-event-streaming', name: 'Live event streaming', priceAud: 650, description: '' }],
    };
    expect(liveContentView({ extras: [] }, false, config).label).toBe('Live event streaming, $650 extra');
  });
});
