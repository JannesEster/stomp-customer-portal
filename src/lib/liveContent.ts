import { extrasConfig, type ExtrasConfig } from '../config';
import type { Booking } from '../types';
import { formatAud } from './format';

/** Shown under the live content tick. Nothing is charged in the portal. */
export const LIVE_CONTENT_PRICE_NOTE =
  'If adding live content changes your price, Stomp Sphere will confirm with you first. Nothing is charged in the portal.';

/**
 * Ticking live content records a request only.
 * Stomp Sphere confirms any price change. The portal does not charge.
 */

export interface LiveContentView {
  /** Already part of the booking, so no extra charge */
  included: boolean;
  checked: boolean;
  locked: boolean;
  label: string;
  priceAud: number;
}

export function liveContentView(
  booking: Pick<Booking, 'extras'>,
  requested: boolean,
  config: ExtrasConfig = extrasConfig,
): LiveContentView {
  const extra = config.extras.find((e) => e.id === config.liveContentExtraId);
  const name = extra?.name ?? 'Live event streaming';
  const priceAud = extra?.priceAud ?? 0;
  const included = booking.extras.includes(config.liveContentExtraId);

  if (included) {
    return { included, checked: true, locked: true, label: `${name}, included in your booking`, priceAud };
  }
  return { included, checked: requested, locked: false, label: `${name}, ${formatAud(priceAud)} extra`, priceAud };
}
