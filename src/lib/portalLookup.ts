import {
  PORTAL_ANSWERS_FIELD,
  PORTAL_FIRST_OPENED_FIELD,
  PORTAL_LAST_SAVED_FIELD,
  type AirtableFieldNames,
} from './airtableFields';
import { mapPortalRecords, type AirtableRecord, type ExtraCatalogItem, type MappedPortal } from './bookingMap';
import { DESIGN_VERSION } from './design';
import { buildPortalUrl, isValidPortalToken, portalTokenFormula } from './portalToken';

const RECORD_ID = /^rec[A-Za-z0-9]{14}$/;

export interface AirtableGateway {
  findBookingsByFormula(formula: string): Promise<AirtableRecord[]>;
  getLead(id: string): Promise<AirtableRecord | null>;
  getVenue(id: string): Promise<AirtableRecord | null>;
}

/** Portal fields read with the booking. firstOpenedAt is not returned by GET. */
export interface PortalSavedState {
  savedAnswers: unknown;
  lastSavedAt: string | null;
  firstOpenedAt: string | null;
}

export type PortalLookupResult =
  | { ok: true; portal: MappedPortal; portalUrl: string | null; saved: PortalSavedState }
  | { ok: false; status: 400 | 404; error: 'invalid_token' | 'not_found' };

/**
 * Look up exactly one booking by its portal token.
 * Malformed tokens never reach Airtable. Zero or several matches are a 404.
 */
export async function lookupBookingByToken(
  token: string,
  opts: {
    gateway: AirtableGateway;
    tokenFieldName: string;
    fields: AirtableFieldNames;
    extras: ExtraCatalogItem[];
    publicBaseUrl: string | null;
  },
): Promise<PortalLookupResult> {
  if (!isValidPortalToken(token)) {
    return { ok: false, status: 400, error: 'invalid_token' };
  }

  const formula = portalTokenFormula(token, opts.tokenFieldName);
  const matches = await opts.gateway.findBookingsByFormula(formula);
  if (matches.length !== 1) {
    return { ok: false, status: 404, error: 'not_found' };
  }

  const booking = matches[0];
  const leadId = firstRecordId(booking.fields[opts.fields.leadLink]);
  const venueId = firstRecordId(booking.fields[opts.fields.venueLink]);
  const [lead, venue] = await Promise.all([
    leadId ? opts.gateway.getLead(leadId) : Promise.resolve(null),
    venueId ? opts.gateway.getVenue(venueId) : Promise.resolve(null),
  ]);

  return {
    ok: true,
    portal: mapPortalRecords(booking, lead, venue, opts.fields, opts.extras),
    portalUrl: buildPortalUrl(opts.publicBaseUrl, token),
    saved: {
      savedAnswers: parseSavedAnswers(booking.fields[PORTAL_ANSWERS_FIELD]),
      lastSavedAt: readTimestamp(booking.fields[PORTAL_LAST_SAVED_FIELD]),
      firstOpenedAt: readTimestamp(booking.fields[PORTAL_FIRST_OPENED_FIELD]),
    },
  };
}

export function firstRecordId(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  for (const item of value) {
    const id = typeof item === 'string' ? item : readId(item);
    if (id && RECORD_ID.test(id)) return id;
  }
  return null;
}

function parseSavedAnswers(value: unknown): unknown {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    if ((parsed as { version?: unknown }).version !== DESIGN_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

function readTimestamp(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 40) return null;
  return trimmed;
}

function readId(value: unknown): string | null {
  if (!value || typeof value !== 'object' || !('id' in value)) return null;
  const id = (value as { id: unknown }).id;
  return typeof id === 'string' ? id : null;
}
