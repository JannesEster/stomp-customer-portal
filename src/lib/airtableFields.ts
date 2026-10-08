/** Snapshot of the Stomp base on 7 Oct 2026. Names are the defaults. Ids are optional. */
export const DEFAULT_BASE_ID = 'appwMfJFb7rLDqJ30';

export const DEFAULT_TABLES = {
  bookings: 'Bookings',
  leads: 'Leads',
  venues: 'Venues',
} as const;

export const DEFAULT_TOKEN_FIELD = 'Portal token';

/** Known field id for Portal token. Optional write key. The formula filter still uses the field name. */
export const KNOWN_PORTAL_TOKEN_FIELD_ID = 'fldBr9O48s8nRuxrm';

/**
 * Fields the portal may read. Everything else on the booking, including
 * Important notes and Customer Xero account link, stays on the server's ignore list.
 */
export interface AirtableFieldNames {
  bookingName: string;
  leadLink: string;
  eventDate: string;
  venueLink: string;
  address: string;
  packageName: string;
  floorSqm: string;
  leadName: string;
  leadEmail: string;
  leadAddOns: string;
  leadVenueName: string;
  venueName: string;
  venueAddress: string;
  /**
   * Staff-entered supplier names on Bookings. The lookup requests these exact
   * names and the portal returns them as starting values. The portal never writes them.
   * The old Wedding Planners field is unused and is never fetched.
   */
  weddingPlanner: string;
  photographer: string;
  videographer: string;
  dj: string;
  otherSuppliers: string;
}

export const DEFAULT_FIELD_NAMES: AirtableFieldNames = {
  bookingName: 'Booking name',
  leadLink: 'Lead',
  eventDate: 'Event date',
  venueLink: 'Venue',
  address: 'Address',
  packageName: 'Package',
  floorSqm: 'Floor sqm',
  leadName: 'Name',
  leadEmail: 'Email',
  leadAddOns: 'Add-ons',
  leadVenueName: 'Venue name',
  venueName: 'Venue name',
  venueAddress: 'Address',
  weddingPlanner: 'Wedding planner',
  photographer: 'Photographer',
  videographer: 'Videographer',
  dj: 'DJ',
  otherSuppliers: 'Other suppliers',
};

/**
 * The only Bookings fields a portal write may set, by name.
 * PATCH bodies are filtered to this list. Anything else is dropped.
 */
export const PORTAL_WRITE_FIELDS = [
  'Portal answers',
  'Portal summary',
  'Portal progress',
  'Portal steps missing',
  'Portal last saved',
  'Portal first opened',
  'Portal floor design',
  'Portal floor preview',
  'Portal suppliers',
] as const;

export type PortalWriteField = (typeof PORTAL_WRITE_FIELDS)[number];

export const PORTAL_ANSWERS_FIELD: PortalWriteField = 'Portal answers';
export const PORTAL_SUMMARY_FIELD: PortalWriteField = 'Portal summary';
export const PORTAL_PROGRESS_FIELD: PortalWriteField = 'Portal progress';
export const PORTAL_STEPS_MISSING_FIELD: PortalWriteField = 'Portal steps missing';
export const PORTAL_LAST_SAVED_FIELD: PortalWriteField = 'Portal last saved';
export const PORTAL_FIRST_OPENED_FIELD: PortalWriteField = 'Portal first opened';
export const PORTAL_FLOOR_DESIGN_FIELD: PortalWriteField = 'Portal floor design';
export const PORTAL_FLOOR_PREVIEW_FIELD: PortalWriteField = 'Portal floor preview';
/** Filled supplier roles, one line each. An empty string when the couple has named nobody. */
export const PORTAL_SUPPLIERS_FIELD: PortalWriteField = 'Portal suppliers';

/**
 * Read with the booking lookup so a return visit can hydrate, and so the first
 * opened stamp is only written when it is still blank. Not part of the public booking.
 */
export const PORTAL_READ_FIELDS = [
  PORTAL_ANSWERS_FIELD,
  PORTAL_LAST_SAVED_FIELD,
  PORTAL_FIRST_OPENED_FIELD,
] as const;

const PORTAL_WRITE_FIELD_SET = new Set<string>(PORTAL_WRITE_FIELDS);

/** Keep a PATCH to the write whitelist. Extra keys, including anything the client posted, are dropped. */
export function pickPortalWriteFields(fields: Record<string, unknown>): Partial<Record<PortalWriteField, unknown>> {
  const picked: Partial<Record<PortalWriteField, unknown>> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (PORTAL_WRITE_FIELD_SET.has(key)) picked[key as PortalWriteField] = value;
  }
  return picked;
}

/** Never request these. Portal link is a formula and must not be written either. */
export const PRIVATE_OR_UNUSED_FIELDS = [
  'Important notes',
  'Customer Xero account link',
  'Portal link',
  'Fillout submission id',
  'Booking form URL used',
  'Quoted amount AUD',
  'Deposit %',
  'Deposit amount',
  'Deposit status',
  'Balance due date',
  'Balance status',
  'Contract status',
  'Deposit invoice link',
  'Final invoice link',
  'Final invoice',
  'Activity',
  'Busy Dates',
  'Wedding Planners',
  'Phone',
] as const;

export function bookingFieldsToFetch(fields: AirtableFieldNames): string[] {
  return unique([
    fields.bookingName,
    fields.leadLink,
    fields.eventDate,
    fields.venueLink,
    fields.address,
    fields.packageName,
    fields.floorSqm,
    fields.weddingPlanner,
    fields.photographer,
    fields.videographer,
    fields.dj,
    fields.otherSuppliers,
  ]);
}

export function leadFieldsToFetch(fields: AirtableFieldNames): string[] {
  return unique([fields.leadName, fields.leadEmail, fields.leadAddOns, fields.leadVenueName]);
}

export function venueFieldsToFetch(fields: AirtableFieldNames): string[] {
  return unique([fields.venueName, fields.venueAddress]);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
