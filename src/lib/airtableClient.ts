import {
  bookingFieldsToFetch,
  pickPortalWriteFields,
  PORTAL_FLOOR_PREVIEW_FIELD,
  PORTAL_READ_FIELDS,
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
const AIRTABLE_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
const PREVIEW_FILENAMES = new Set(['floor-holding.png', 'floor-after.png', 'floor-dancing.png']);
const WRITE_OPS = new Set(['patchBooking', 'uploadFloorPreview']);
const SAFE_LABEL = /^[A-Za-z0-9][A-Za-z0-9 _-]{0,80}$/;
/** Airtable error.type values are short SNAKE_CASE codes, never a token or a sentence. */
const SAFE_TYPE = /^[A-Z][A-Z0-9_]{0,63}$/;

export type AirtableLog = (line: string) => void;

/** Failure details that are safe to print. Never includes the response body or the token. */
export class AirtableRequestError extends Error {
  readonly status: number;
  readonly table: string;
  readonly operation: string;
  readonly airtableType: string;

  constructor(info: { status: number; table: string; operation: string; airtableType: string | null }) {
    super(`Airtable request failed (${info.status})`);
    this.name = 'AirtableRequestError';
    this.status = info.status;
    this.table = SAFE_LABEL.test(info.table) ? info.table : 'unknown';
    this.operation = SAFE_LABEL.test(info.operation) ? info.operation : 'unknown';
    this.airtableType = safeAirtableType(info.airtableType);
  }

  /** One line for the Airtable client. */
  clientLogLine(): string {
    return `airtable ${this.operation} failed status=${this.status} table=${this.table} type=${this.airtableType}`;
  }

  /** One line for the portal route. */
  portalLogLine(): string {
    return `portal lookup upstream failure status=${this.status} table=${this.table} operation=${this.operation} type=${this.airtableType}`;
  }
}

export function portalLookupFailureLine(err: unknown): string {
  if (err instanceof AirtableRequestError) return err.portalLogLine();
  return 'portal lookup upstream failure';
}

/** One safe line for a portal write. No token, no answers, no response body. */
export function portalWriteFailureLine(err: unknown): string {
  if (err instanceof AirtableRequestError) {
    return `portal write upstream failure status=${err.status} table=${err.table} operation=${err.operation} type=${err.airtableType}`;
  }
  return 'portal write upstream failure';
}

export interface PortalWriter {
  /** PATCH one booking. Only PORTAL_WRITE_FIELDS are sent, with typecast false. */
  patchBooking(recordId: string, fields: Record<string, unknown>): Promise<void>;
  /** Append one PNG to Portal floor preview. The caller clears that field first. */
  uploadFloorPreview(recordId: string, file: { base64: string; filename: string }): Promise<void>;
}

export interface AirtableClient extends AirtableGateway, PortalWriter {
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
  log: AirtableLog = console.error,
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

  async function readJson(res: Response, call: { table: string; operation: string }): Promise<unknown> {
    if (!res.ok) {
      // Keep error.type only. error.message and the rest of the body can echo record data.
      const failure = new AirtableRequestError({
        status: res.status,
        table: call.table,
        operation: call.operation,
        airtableType: await readErrorType(res),
      });
      if ((res.status === 401 || res.status === 403) && WRITE_OPS.has(call.operation)) {
        log(`airtable update forbidden status=${res.status}`);
      } else {
        log(failure.clientLogLine());
      }
      throw failure;
    }
    return res.json();
  }

  return {
    async findBookingsByFormula(formula: string): Promise<AirtableRecord[]> {
      if (!formula.trim()) throw new Error('Refusing an empty Airtable filter');
      const params = new URLSearchParams();
      params.set('filterByFormula', formula);
      params.set('maxRecords', '2');
      for (const name of [...bookingFieldsToFetch(config.fields), ...PORTAL_READ_FIELDS]) {
        params.append('fields[]', name);
      }
      const res = await request(config.bookingsTable, params.toString());
      const body = (await readJson(res, { table: config.bookingsTable, operation: 'findBookings' })) as {
        records?: unknown[];
      };
      return (body.records ?? []).flatMap((record) => {
        const parsed = asRecord(record);
        return parsed ? [parsed] : [];
      });
    },

    async getLead(id: string): Promise<AirtableRecord | null> {
      return getOne(config.leadsTable, id, leadFieldsToFetch(config.fields), 'getLead');
    },

    async getVenue(id: string): Promise<AirtableRecord | null> {
      return getOne(config.venuesTable, id, venueFieldsToFetch(config.fields), 'getVenue');
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
        const body = (await readJson(res, {
          table: config.bookingsTable,
          operation: 'listBookingsForTokenFill',
        })) as { records?: unknown[]; offset?: string };
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
      return getOne(config.bookingsTable, id, [config.tokenFieldName], 'getBookingForTokenFill');
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
        await readJson(res, { table: config.bookingsTable, operation: 'writePortalTokens' });
      }
    },

    async patchBooking(recordId: string, fields: Record<string, unknown>): Promise<void> {
      if (!RECORD_ID.test(recordId)) throw new Error('Refusing a portal write for a bad record id');
      const picked = pickPortalWriteFields(fields);
      if (Object.keys(picked).length === 0) return;
      const res = await request(`${config.bookingsTable}/${recordId}`, '', {
        method: 'PATCH',
        body: JSON.stringify({ fields: picked, typecast: false }),
      });
      await readJson(res, { table: config.bookingsTable, operation: 'patchBooking' });
    },

    async uploadFloorPreview(recordId: string, file: { base64: string; filename: string }): Promise<void> {
      if (!RECORD_ID.test(recordId)) throw new Error('Refusing a portal write for a bad record id');
      const filename = PREVIEW_FILENAMES.has(file.filename) ? file.filename : 'floor-holding.png';
      const base64 = file.base64.replace(/\s/g, '');
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new Error('Refusing a portal preview that is not base64');
      const bytes = Buffer.from(base64, 'base64');
      if (bytes.length === 0 || bytes.length > AIRTABLE_ATTACHMENT_MAX_BYTES) {
        throw new Error('Refusing a portal preview outside the attachment size limit');
      }
      const url = `https://content.airtable.com/v0/${encodeURIComponent(config.baseId)}/${recordId}/${encodeURIComponent(PORTAL_FLOOR_PREVIEW_FIELD)}/uploadAttachment`;
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ contentType: 'image/png', file: base64, filename }),
        signal: AbortSignal.timeout(20_000),
      });
      await readJson(res, { table: config.bookingsTable, operation: 'uploadFloorPreview' });
    },
  };

  /**
   * The single-record Airtable endpoint rejects fields[], so this uses the list
   * endpoint with RECORD_ID() and the same field whitelist.
   */
  async function getOne(
    table: string,
    id: string,
    fieldNames: string[],
    operation: string,
  ): Promise<AirtableRecord | null> {
    if (!RECORD_ID.test(id)) return null;
    const params = new URLSearchParams();
    params.set('filterByFormula', `RECORD_ID()='${id}'`);
    params.set('maxRecords', '1');
    for (const name of fieldNames) params.append('fields[]', name);
    const res = await request(table, params.toString());
    const body = (await readJson(res, { table, operation })) as { records?: unknown[] };
    const match = (body.records ?? []).flatMap((record) => {
      const parsed = asRecord(record);
      return parsed && parsed.id === id ? [parsed] : [];
    });
    return match[0] ?? null;
  }
}

function safeAirtableType(type: string | null): string {
  if (!type || !SAFE_TYPE.test(type) || !type.includes('_')) return 'unknown';
  return type;
}

/** Pull error.type and discard the rest of an Airtable error body. */
async function readErrorType(res: Response): Promise<string | null> {
  try {
    const body: unknown = await res.json();
    if (!body || typeof body !== 'object' || !('error' in body)) return null;
    const error = (body as { error?: unknown }).error;
    if (!error || typeof error !== 'object' || !('type' in error)) return null;
    const type = (error as { type?: unknown }).type;
    return typeof type === 'string' ? type : null;
  } catch {
    return null;
  }
}

function asRecord(value: unknown): AirtableRecord | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as { id?: unknown; fields?: unknown };
  if (typeof record.id !== 'string' || !RECORD_ID.test(record.id)) return null;
  if (record.fields != null && (typeof record.fields !== 'object' || Array.isArray(record.fields))) return null;
  return { id: record.id, fields: (record.fields as Record<string, unknown> | null) ?? {} };
}
