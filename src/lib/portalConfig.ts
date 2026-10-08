import {
  DEFAULT_BASE_ID,
  DEFAULT_FIELD_NAMES,
  DEFAULT_TABLES,
  DEFAULT_TOKEN_FIELD,
  type AirtableFieldNames,
} from './airtableFields';
import { isSafeAirtableFieldName } from './portalToken';

const BASE_ID = /^app[A-Za-z0-9]{14}$/;
const FIELD_ID = /^fld[A-Za-z0-9]{14}$/;
const TABLE = /^(?:tbl[A-Za-z0-9]{14}|[A-Za-z][A-Za-z0-9 _-]{0,80})$/;

export class PortalConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PortalConfigError';
  }
}

export interface PortalEnvConfig {
  airtableToken: string | null;
  baseId: string;
  bookingsTable: string;
  leadsTable: string;
  venuesTable: string;
  /** Name used in filterByFormula. */
  tokenFieldName: string;
  /** When set, token writes use this field id instead of the name. */
  tokenFieldId: string | null;
  publicBaseUrl: string | null;
  fields: AirtableFieldNames;
  port: number;
}

export function readPortalConfig(env: Record<string, string | undefined>): PortalEnvConfig {
  const token = blankToNull(env.AIRTABLE_TOKEN);
  const baseId = env.AIRTABLE_BASE_ID?.trim() || DEFAULT_BASE_ID;
  if (!BASE_ID.test(baseId)) throw new PortalConfigError('AIRTABLE_BASE_ID is not a base id');

  const configuredTokenField = env.PORTAL_TOKEN_FIELD?.trim() || DEFAULT_TOKEN_FIELD;
  const explicitId = blankToNull(env.PORTAL_TOKEN_FIELD_ID);
  let tokenFieldName = configuredTokenField;
  let tokenFieldId = explicitId;
  if (FIELD_ID.test(configuredTokenField)) {
    tokenFieldId = explicitId ?? configuredTokenField;
    tokenFieldName = env.PORTAL_TOKEN_FIELD_NAME?.trim() || DEFAULT_TOKEN_FIELD;
  }
  if (!isSafeAirtableFieldName(tokenFieldName)) {
    throw new PortalConfigError('PORTAL_TOKEN_FIELD is not a safe field name');
  }
  if (tokenFieldId && !FIELD_ID.test(tokenFieldId)) {
    throw new PortalConfigError('PORTAL_TOKEN_FIELD_ID is not a field id');
  }

  const fields = fieldNamesFromEnv(env);
  const publicBaseUrl = blankToNull(env.PUBLIC_BASE_URL);
  if (publicBaseUrl && !isAcceptableBaseUrl(publicBaseUrl)) {
    throw new PortalConfigError('PUBLIC_BASE_URL must be an https URL, or http://localhost');
  }

  return {
    airtableToken: token,
    baseId,
    bookingsTable: tableFromEnv(env.AIRTABLE_BOOKINGS_TABLE, DEFAULT_TABLES.bookings, 'AIRTABLE_BOOKINGS_TABLE'),
    leadsTable: tableFromEnv(env.AIRTABLE_LEADS_TABLE, DEFAULT_TABLES.leads, 'AIRTABLE_LEADS_TABLE'),
    venuesTable: tableFromEnv(env.AIRTABLE_VENUES_TABLE, DEFAULT_TABLES.venues, 'AIRTABLE_VENUES_TABLE'),
    tokenFieldName,
    tokenFieldId,
    publicBaseUrl: publicBaseUrl ? publicBaseUrl.replace(/\/$/, '') : null,
    fields,
    port: portFromEnv(env.PORT),
  };
}

/** Key used when writing Portal token. Field id when configured, otherwise the name. */
export function portalTokenWriteKey(config: Pick<PortalEnvConfig, 'tokenFieldId' | 'tokenFieldName'>): string {
  return config.tokenFieldId ?? config.tokenFieldName;
}

function fieldNamesFromEnv(env: Record<string, string | undefined>): AirtableFieldNames {
  const entries = Object.entries(DEFAULT_FIELD_NAMES) as [keyof AirtableFieldNames, string][];
  const envKey: Record<keyof AirtableFieldNames, string> = {
    bookingName: 'BOOKING_NAME_FIELD',
    leadLink: 'LEAD_LINK_FIELD',
    eventDate: 'EVENT_DATE_FIELD',
    venueLink: 'VENUE_LINK_FIELD',
    address: 'ADDRESS_FIELD',
    packageName: 'PACKAGE_FIELD',
    floorSqm: 'FLOOR_SQM_FIELD',
    leadName: 'LEAD_NAME_FIELD',
    leadEmail: 'LEAD_EMAIL_FIELD',
    leadAddOns: 'LEAD_ADDONS_FIELD',
    leadVenueName: 'LEAD_VENUE_NAME_FIELD',
    venueName: 'VENUE_NAME_FIELD',
    venueAddress: 'VENUE_ADDRESS_FIELD',
    weddingPlanner: 'WEDDING_PLANNER_FIELD',
    photographer: 'PHOTOGRAPHER_FIELD',
    videographer: 'VIDEOGRAPHER_FIELD',
    dj: 'DJ_FIELD',
    otherSuppliers: 'OTHER_SUPPLIERS_FIELD',
  };
  const fields = {} as AirtableFieldNames;
  for (const [key, fallback] of entries) {
    const value = env[envKey[key]]?.trim() || fallback;
    if (!isSafeAirtableFieldName(value)) {
      throw new PortalConfigError(`${envKey[key]} is not a safe field name`);
    }
    fields[key] = value;
  }
  return fields;
}

function tableFromEnv(value: string | undefined, fallback: string, label: string): string {
  const table = value?.trim() || fallback;
  if (!TABLE.test(table)) throw new PortalConfigError(`${label} is not a table name or id`);
  return table;
}

function portFromEnv(value: string | undefined): number {
  if (!value?.trim()) return 3000;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new PortalConfigError('PORT must be an integer from 1 to 65535');
  }
  return port;
}

function blankToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function isAcceptableBaseUrl(value: string): boolean {
  const trimmed = value.trim().replace(/\/$/, '');
  return (
    /^https:\/\/[a-z0-9.-]+(?::\d+)?(?:\/[A-Za-z0-9._~/-]+)?$/i.test(trimmed) ||
    /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(trimmed)
  );
}
