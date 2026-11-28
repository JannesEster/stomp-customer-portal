import { describe, expect, it } from 'vitest';
import { stepsFor } from '../design/steps';
import { DEMO_STORAGE_NOTE, FIRST_FLOOR_PREVIEW, HERO_PORTAL_LINE } from './customerCopy';
import { floorPixels } from './dimensions';
import { floorReviewLine } from './format';
import { LIVE_CONTENT_PRICE_NOTE } from './liveContent';

const CUSTOMER_COPY = [HERO_PORTAL_LINE, FIRST_FLOOR_PREVIEW, DEMO_STORAGE_NOTE, LIVE_CONTENT_PRICE_NOTE];

describe('phone copy', () => {
  it('names the Stomp Sphere event portal in the body', () => {
    expect(HERO_PORTAL_LINE).toBe('Your Stomp Sphere event portal');
  });

  it('tells the couple to tap Next on the first floor preview', () => {
    expect(FIRST_FLOOR_PREVIEW).toBe(
      'This is a preview of your floor. Nothing is set yet. Tap Next to choose your effects.',
    );
    const intros = stepsFor(2, true).map((step) => step.intro).join(' ');
    expect(intros).toContain('tap one to see it move');
    expect(intros).not.toMatch(/hover or tap|Click /);
  });

  it('uses customer wording for live content and the demo save note', () => {
    expect(LIVE_CONTENT_PRICE_NOTE).toBe(
      'If adding live content changes your price, Stomp Sphere will confirm with you first. Nothing is charged in the portal.',
    );
    expect(DEMO_STORAGE_NOTE).toBe(
      'This demo keeps designs and files in this browser only. A booking link saves them to your Stomp Sphere booking.',
    );
  });

  it('keeps internal words, dashes, and the times sign out of the new copy', () => {
    for (const line of CUSTOMER_COPY) {
      expect(line).not.toMatch(/Jannes|pending|TODO|Click /i);
      expect(line).not.toMatch(/[—–×]/);
    }
  });

  it('writes the review floor size with a plain x', () => {
    const line = floorReviewLine({ widthM: 4, lengthM: 3 }, 12, floorPixels(4, 3));
    expect(line).toBe('Floor 4m x 3m (1024 x 768 px)');
    expect(line).not.toMatch(/[×✕]/);
    expect(floorReviewLine({ widthM: 6, lengthM: 4.5 }, 27, floorPixels(6, 4.5))).toBe(
      'Floor 6m x 4.5m (1536 x 1152 px)',
    );
    expect(floorReviewLine(null, 15, null)).toBe('Width and length are not listed yet.');
    expect(floorReviewLine(null, 15, null)).not.toMatch(/sqm/);
  });
});