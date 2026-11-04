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
const WRITE_OPS = new Set(['patchBooking', 'uploadFloorPreview', 'uploadPortalFile']);
const ATTACHMENT_ID = /^att[A-Za-z0-9]{14}$/;
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

export interface PortalAttachment {
  id: string;
  url: string;
  thumbUrl: string | null;
  type: string;
  filename: string;
  size: number;
}

export interface PortalWriter {
  /** PATCH one booking. Only PORTAL_WRITE_FIELDS are sent, with typecast false. */
  patchBooking(recordId: string, fields: Record<string, unknown>): Promise<void>;
  /** Append one PNG to Portal floor preview. The caller clears that field first. */
  uploadFloorPreview(recordId: string, file: { base64: string; filename: string }): Promise<void>;
  /** Append one customer file to Portal uploads. Returns the attachment id and nothing else. */
  uploadPortalFile(
    recordId: string,
    file: { base64: string; filename: string; contentType: string },
  ): Promise<{ id: string }>;
  /** Current Portal uploads attachments. URLs are fresh and must not be stored. */
  listPortalUploads(recordId: string): Promise<PortalAttachment[]>;
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
      const picked = pickPortalWriteFields(fields, [
        config.portalUploadsFieldId,
        config.portalUploadsListFieldId,
      ]);
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

    async uploadPortalFile(
      recordId: string,
      file: { base64: string; filename: string; contentType: string },
    ): Promise<{ id: string }> {
      if (!RECORD_ID.test(recordId)) throw new Error('Refusing a portal write for a bad record id');
      const contentType = file.contentType.toLowerCase();
      if (!/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(contentType)) {
        throw new Error('Refusing a portal upload with an unsafe content type');
      }
      const base64 = file.base64.replace(/\s/g, '');
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new Error('Refusing a portal upload that is not base64');
      const bytes = Buffer.from(base64, 'base64');
      if (bytes.length === 0 || bytes.length > AIRTABLE_ATTACHMENT_MAX_BYTES) {
        throw new Error('Refusing a portal upload outside the attachment size limit');
      }
      const filename = file.filename.replace(/[^\w.\- ()]+/g, '').slice(0, 180) || 'file';
      const url = `https://content.airtable.com/v0/${encodeURIComponent(config.baseId)}/${recordId}/${encodeURIComponent(config.portalUploadsFieldId)}/uploadAttachment`;
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ contentType, file: base64, filename }),
        signal: AbortSignal.timeout(60_000),
      });
      const body = await readJson(res, { table: config.bookingsTable, operation: 'uploadPortalFile' });
      const id = attachmentIdFrom(body, filename);
      if (!id) throw new Error('Airtable upload returned no attachment id');
      return { id };
    },

    async listPortalUploads(recordId: string): Promise<PortalAttachment[]> {
      if (!RECORD_ID.test(recordId)) return [];
      const params = new URLSearchParams();
      params.set('filterByFormula', `RECORD_ID()='${recordId}'`);
      params.set('maxRecords', '1');
      params.set('returnFieldsByFieldId', 'true');
      params.append('fields[]', config.portalUploadsFieldId);
      const res = await request(config.bookingsTable, params.toString());
      const body = (await readJson(res, { table: config.bookingsTable, operation: 'listPortalUploads' })) as {
        records?: unknown[];
      };
      const match = (body.records ?? []).flatMap((record) => {
        const parsed = asRecord(record);
        return parsed && parsed.id === recordId ? [parsed] : [];
      })[0];
      return parseAttachments(match?.fields?.[config.portalUploadsFieldId]);
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

/**
 * uploadAttachment replies with the record: { id: rec..., fields: { <fieldId>: [attachments] } }.
 * The new file is the last attachment with the filename we sent. Older shapes with a top level att id still work.
 */
export function attachmentIdFrom(body: unknown, filename?: string): string | null {
  if (!body || typeof body !== 'object') return null;
  const top = (body as { id?: unknown }).id;
  if (typeof top === 'string' && ATTACHMENT_ID.test(top)) return top;
  const fields = (body as { fields?: unknown }).fields;
  if (!fields || typeof fields !== 'object') return null;
  const items: Array<{ id?: unknown; filename?: unknown }> = [];
  for (const value of Object.values(fields as Record<string, unknown>)) {
    if (Array.isArray(value)) for (const item of value) if (item && typeof item === 'object') items.push(item);
  }
  const valid = items.filter((item) => typeof item.id === 'string' && ATTACHMENT_ID.test(item.id));
  const named = filename ? valid.filter((item) => item.filename === filename) : [];
  const pick = (named.length ? named : valid).at(-1);
  return pick ? (pick.id as string) : null;
}

/** Keep https links on Airtable's own file hosts. Anything else is dropped before it can be fetched. */
export function isAirtableFileUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    return url.hostname === 'dl.airtable.com' || url.hostname.endsWith('.airtableusercontent.com');
  } catch {
    return false;
  }
}

function parseAttachments(value: unknown): PortalAttachment[] {
  if (!Array.isArray(value)) return [];
  const attachments: PortalAttachment[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const source = item as Record<string, unknown>;
    const id = source.id;
    const url = source.url;
    if (typeof id !== 'string' || !ATTACHMENT_ID.test(id)) continue;
    if (typeof url !== 'string' || !isAirtableFileUrl(url)) continue;
    const thumbs = source.thumbnails as { large?: { url?: unknown }; small?: { url?: unknown } } | undefined;
    const large = thumbs?.large?.url;
    const small = thumbs?.small?.url;
    const thumb = typeof large === 'string' ? large : typeof small === 'string' ? small : null;
    attachments.push({
      id,
      url,
      thumbUrl: thumb && isAirtableFileUrl(thumb) ? thumb : null,
      type: typeof source.type === 'string' ? source.type : 'application/octet-stream',
      filename: typeof source.filename === 'string' ? source.filename : 'file',
      size: typeof source.size === 'number' && Number.isFinite(source.size) ? source.size : 0,
    });
  }
  return attachments;
}

function asRecord(value: unknown): AirtableRecord | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as { id?: unknown; fields?: unknown };
  if (typeof record.id !== 'string' || !RECORD_ID.test(record.id)) return null;
  if (record.fields != null && (typeof record.fields !== 'object' || Array.isArray(record.fields))) return null;
  return { id: record.id, fields: (record.fields as Record<string, unknown> | null) ?? {} };
}
