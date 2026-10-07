import type { AirtableFieldNames } from './airtableFields';
import { mapPortalRecords, type AirtableRecord, type ExtraCatalogItem, type MappedPortal } from './bookingMap';
import { buildPortalUrl, isValidPortalToken, portalTokenFormula } from './portalToken';

const RECORD_ID = /^rec[A-Za-z0-9]{14}$/;

export interface AirtableGateway {
  findBookingsByFormula(formula: string): Promise<AirtableRecord[]>;
  getLead(id: string): Promise<AirtableRecord | null>;
  getVenue(id: string): Promise<AirtableRecord | null>;
}

export type PortalLookupResult =
  | { ok: true; portal: MappedPortal; portalUrl: string | null }
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

function readId(value: unknown): string | null {
  if (!value || typeof value !== 'object' || !('id' in value)) return null;
  const id = (value as { id: unknown }).id;
  return typeof id === 'string' ? id : null;
}
