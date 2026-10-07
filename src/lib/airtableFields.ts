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
};

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
