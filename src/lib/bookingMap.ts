import type { AirtableFieldNames } from './airtableFields';
import { KNOWN_FLOORS } from './knownFloors';
import type { Booking, Customer } from '../types';

export interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

export interface ExtraCatalogItem {
  id: string;
  name: string;
}

/** Keys the API is allowed to put on a booking. Internal Airtable fields are not in this list. */
export const PUBLIC_BOOKING_KEYS = [
  'id',
  'customerId',
  'coupleNames',
  'eventDate',
  'venue',
  'address',
  'packageName',
  'floor',
  'floorSqm',
  'screensBooked',
  'extras',
] as const;

export const PUBLIC_CUSTOMER_KEYS = ['id', 'name', 'email', 'bookingIds'] as const;

export interface MappedPortal {
  customer: Customer;
  booking: Booking;
}

/**
 * Turn one booking, its lead, and its venue into the portal shape.
 * Copies only whitelisted values. Other field contents are dropped.
 */
export function mapPortalRecords(
  booking: AirtableRecord,
  lead: AirtableRecord | null,
  venue: AirtableRecord | null,
  fields: AirtableFieldNames,
  extras: ExtraCatalogItem[],
): MappedPortal {
  const leadFields = lead?.fields ?? {};
  const venueFields = venue?.fields ?? {};
  const bookingFields = booking.fields;

  const leadName = asString(leadFields[fields.leadName]);
  const bookingName = asString(bookingFields[fields.bookingName]);
  const coupleNames = leadName || bookingName;
  const email = asString(leadFields[fields.leadEmail]);
  const customerId = lead?.id || booking.id;

  const venueName =
    asString(venueFields[fields.venueName]) || asString(leadFields[fields.leadVenueName]);
  const address = asString(bookingFields[fields.address]) || asString(venueFields[fields.venueAddress]);
  const floorSqm = asFiniteNumber(bookingFields[fields.floorSqm]);
  const addOns = asStringList(leadFields[fields.leadAddOns]);
  const split = splitAddOns(addOns, extras);

  const mapped: Booking = {
    id: booking.id,
    customerId,
    coupleNames,
    eventDate: asDate(bookingFields[fields.eventDate]),
    venue: venueName,
    address: address || null,
    packageName: asString(bookingFields[fields.packageName]) || null,
    floor: floorFromSqm(floorSqm),
    floorSqm,
    screensBooked: split.screensBooked,
    extras: split.extras,
  };

  const customer: Customer = {
    id: customerId,
    name: coupleNames,
    email,
    bookingIds: [booking.id],
  };

  return { customer: pickKeys(customer, PUBLIC_CUSTOMER_KEYS), booking: pickKeys(mapped, PUBLIC_BOOKING_KEYS) };
}

/**
 * 12 sqm is 4m x 3m. 27 sqm is 6m x 4.5m.
 * Any other area has no width and length. Callers must not invent one.
 */
export function floorFromSqm(sqm: number | null): { widthM: number; lengthM: number } | null {
  if (sqm == null) return null;
  const match = KNOWN_FLOORS.find((size) => Math.abs(size.sqm - sqm) < 0.001);
  return match ? { widthM: match.widthM, lengthM: match.lengthM } : null;
}

/**
 * Screen count is inferred only when an add-on says so.
 * No mention of screens means unknown (null), not zero.
 */
export function splitAddOns(
  addOns: string[],
  extras: ExtraCatalogItem[],
): { extras: string[]; screensBooked: number | null } {
  let screensBooked: number | null = null;
  const mapped: string[] = [];

  for (const raw of addOns) {
    const name = raw.trim();
    if (!name) continue;
    const screens = screensInAddOn(name);
    if (screens != null) {
      screensBooked = (screensBooked ?? 0) + screens;
      continue;
    }
    mapped.push(matchExtra(name, extras));
  }

  return { extras: mapped, screensBooked };
}

function screensInAddOn(name: string): number | null {
  if (/\bno\s+(?:portrait\s+)?screens?\b/i.test(name)) return 0;
  const leading = name.match(/\b(\d+)\s*(?:x\s*)?(?:portrait\s+)?screens?\b/i);
  if (leading) return Number(leading[1]);
  const trailing = name.match(/\b(?:portrait\s+)?screens?\s*x\s*(\d+)\b/i);
  if (trailing) return Number(trailing[1]);
  if (/^(?:a|one|single)\s+portrait\s+screen$/i.test(name) || /^portrait\s+screen$/i.test(name)) return 1;
  return null;
}

function matchExtra(name: string, extras: ExtraCatalogItem[]): string {
  const hit = extras.find((extra) => extra.name.toLowerCase() === name.toLowerCase() || extra.id === name);
  return hit?.id ?? name;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return value;
}

function asDate(value: unknown): string {
  if (typeof value !== 'string') return '';
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return match ? match[1] : '';
}

function pickKeys<T extends object, K extends keyof T>(value: T, keys: readonly K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const key of keys) out[key] = value[key];
  return out;
}
