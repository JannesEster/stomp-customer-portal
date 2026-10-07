import {
  bookingFieldsToFetch,
  leadFieldsToFetch,
  venueFieldsToFetch,
} from './airtableFields';
import type { AirtableRecord } from './bookingMap';
import type { PortalEnvConfig } from './portalConfig';
import { portalTokenWriteKey } from './portalConfig';
import type { AirtableGateway } from './portalLookup';
import { blankTokenFormula } from './portalToken';
import { chunkItems, type TokenPatch, type TokenRecord } from './tokenBatch';

const RECORD_ID = /^rec[A-Za-z0-9]{14}$/;
const AIRTABLE_PATCH_LIMIT = 10;

export interface AirtableClient extends AirtableGateway {
  listBookingsForTokenFill(): Promise<TokenRecord[]>;
  /** One booking, with only the portal token field. Null when the id is missing or malformed. */
  getBookingForTokenFill(id: string): Promise<TokenRecord | null>;
  writePortalTokens(patches: TokenPatch[]): Promise<void>;
}

/**
 * Server-side Airtable client.
 * Booking lookup always sends filterByFormula and maxRecords=2.
 * There is no method that lists every booking.
 */
export function createAirtableClient(
  config: PortalEnvConfig,
  fetchImpl: typeof fetch = fetch,
): AirtableClient {
  if (!config.airtableToken) throw new Error('AIRTABLE_TOKEN is not set');
  const token = config.airtableToken;

  async function request(tablePath: string, query: string, init?: RequestInit): Promise<Response> {
    const encodedPath = tablePath
      .split('/')
      .map((part) => encodeURIComponent(part))
      .join('/');
    const url = `https://api.airtable.com/v0/${encodeURIComponent(config.baseId)}/${encodedPath}${query ? `?${query}` : ''}`;
    const headers = new Headers(init?.headers);
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('Accept', 'application/json');
    if (init?.body) headers.set('Content-Type', 'application/json');
    return fetchImpl(url, { ...init, headers, signal: AbortSignal.timeout(20_000) });
  }

  async function readJson(res: Response): Promise<unknown> {
    if (!res.ok) {
      // Drop the body. Airtable errors can echo record data.
      throw new Error(`Airtable request failed (${res.status})`);
    }
    return res.json();
  }

  return {
    async findBookingsByFormula(formula: string): Promise<AirtableRecord[]> {
      if (!formula.trim()) throw new Error('Refusing an empty Airtable filter');
      const params = new URLSearchParams();
      params.set('filterByFormula', formula);
      params.set('maxRecords', '2');
      for (const name of bookingFieldsToFetch(config.fields)) params.append('fields[]', name);
      const res = await request(config.bookingsTable, params.toString());
      const body = (await readJson(res)) as { records?: unknown[] };
      return (body.records ?? []).flatMap((record) => {
        const parsed = asRecord(record);
        return parsed ? [parsed] : [];
      });
    },

    async getLead(id: string): Promise<AirtableRecord | null> {
      return getOne(config.leadsTable, id, leadFieldsToFetch(config.fields));
    },

    async getVenue(id: string): Promise<AirtableRecord | null> {
      return getOne(config.venuesTable, id, venueFieldsToFetch(config.fields));
    },

    async listBookingsForTokenFill(): Promise<TokenRecord[]> {
      const params = new URLSearchParams();
      params.set('filterByFormula', blankTokenFormula(config.tokenFieldName));
      params.set('pageSize', '100');
      params.append('fields[]', config.tokenFieldName);
      const records: TokenRecord[] = [];
      let offset = '';
      do {
        const page = new URLSearchParams(params);
        if (offset) page.set('offset', offset);
        const res = await request(config.bookingsTable, page.toString());
        const body = (await readJson(res)) as { records?: unknown[]; offset?: string };
        records.push(
          ...(body.records ?? []).flatMap((record) => {
            const parsed = asRecord(record);
            return parsed ? [parsed] : [];
          }),
        );
        offset = body.offset ?? '';
      } while (offset);
      return records;
    },

    async getBookingForTokenFill(id: string): Promise<TokenRecord | null> {
      return getOne(config.bookingsTable, id, [config.tokenFieldName]);
    },

    async writePortalTokens(patches: TokenPatch[]): Promise<void> {
      const key = portalTokenWriteKey(config);
      for (const group of chunkItems(patches, AIRTABLE_PATCH_LIMIT)) {
        const records = group.map((patch) => {
          const value = patch.fields[key] ?? patch.fields[config.tokenFieldName];
          if (!value) throw new Error('Refusing a portal token write with no token');
          return { id: patch.id, fields: { [key]: value } };
        });
        const res = await request(config.bookingsTable, '', {
          method: 'PATCH',
          body: JSON.stringify({ records }),
        });
        await readJson(res);
      }
    },
  };

  async function getOne(table: string, id: string, fieldNames: string[]): Promise<AirtableRecord | null> {
    if (!RECORD_ID.test(id)) return null;
    const params = new URLSearchParams();
    for (const name of fieldNames) params.append('fields[]', name);
    const res = await request(`${table}/${id}`, params.toString());
    if (res.status === 404) return null;
    const body = await readJson(res);
    return asRecord(body);
  }
}

function asRecord(value: unknown): AirtableRecord | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as { id?: unknown; fields?: unknown };
  if (typeof record.id !== 'string' || !RECORD_ID.test(record.id)) return null;
  if (record.fields != null && (typeof record.fields !== 'object' || Array.isArray(record.fields))) return null;
  return { id: record.id, fields: (record.fields as Record<string, unknown> | null) ?? {} };
}
