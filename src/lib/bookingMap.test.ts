import { describe, expect, it } from 'vitest';
import { DEFAULT_FIELD_NAMES, PRIVATE_OR_UNUSED_FIELDS, bookingFieldsToFetch } from './airtableFields';
import { floorFromSqm, mapPortalRecords, PUBLIC_BOOKING_KEYS, PUBLIC_CUSTOMER_KEYS, splitAddOns, type AirtableRecord } from './bookingMap';

const extras = [{ id: 'live-event-streaming', name: 'Live event streaming' }];

describe('floor and add-on mapping', () => {
  it('maps only the two known floor areas', () => {
    expect(floorFromSqm(12)).toEqual({ widthM: 4, lengthM: 3 });
    expect(floorFromSqm(27)).toEqual({ widthM: 6, lengthM: 4.5 });
    expect(floorFromSqm(15)).toBeNull();
    expect(floorFromSqm(null)).toBeNull();
  });

  it('infers screens only when an add-on says so', () => {
    expect(splitAddOns([], extras)).toEqual({ extras: [], screensBooked: null });
    expect(splitAddOns(['Live event streaming'], extras)).toEqual({
      extras: ['live-event-streaming'],
      screensBooked: null,
    });
    expect(splitAddOns(['2 portrait screens', 'Live event streaming'], extras)).toEqual({
      extras: ['live-event-streaming'],
      screensBooked: 2,
    });
    expect(splitAddOns(['Portrait screen'], extras).screensBooked).toBe(1);
    expect(splitAddOns(['No screens'], extras).screensBooked).toBe(0);
    expect(splitAddOns(['Custom uplighting'], extras)).toEqual({
      extras: ['Custom uplighting'],
      screensBooked: null,
    });
  });
});

describe('field whitelist', () => {
  const booking: AirtableRecord = {
    id: 'recFAKEBOOK000001',
    fields: {
      'Booking name': 'Fake celebration',
      Lead: ['recFAKELEAD000001'],
      'Event date': '2027-06-15T10:00:00.000Z',
      Venue: ['recFAKEVENUE00001'],
      Address: '1 Example Street, Perth',
      Package: 'Floor package',
      'Floor sqm': 27,
      'Important notes': 'INTERNAL-NOTE-DO-NOT-LEAK',
      'Customer Xero account link': 'https://example.com/xero-admin-not-for-customers',
      'Portal link': 'https://evil.example/p/stolen',
      'Fillout submission id': 'fillout-secret',
      'Quoted amount AUD': 9999,
      'Portal token': 'A'.repeat(43),
    },
  };
  const lead: AirtableRecord = {
    id: 'recFAKELEAD000001',
    fields: {
      Name: 'Fake Customer',
      Email: 'fake.customer@example.com',
      Phone: '0400000000',
      'Add-ons': ['Live event streaming', '2 portrait screens'],
      'Venue name': 'Lead hall fallback',
    },
  };
  const venue: AirtableRecord = {
    id: 'recFAKEVENUE00001',
    fields: {
      'Venue name': 'Example Hall',
      Address: '2 Venue Road',
    },
  };

  it('keeps customer facing fields and drops internal ones', () => {
    const view = mapPortalRecords(booking, lead, venue, DEFAULT_FIELD_NAMES, extras);
    expect(Object.keys(view.booking).sort()).toEqual([...PUBLIC_BOOKING_KEYS].sort());
    expect(Object.keys(view.customer).sort()).toEqual([...PUBLIC_CUSTOMER_KEYS].sort());
    expect(view.customer).toEqual({
      id: 'recFAKELEAD000001',
      name: 'Fake Customer',
      email: 'fake.customer@example.com',
      bookingIds: ['recFAKEBOOK000001'],
    });
    expect(view.booking).toMatchObject({
      id: 'recFAKEBOOK000001',
      customerId: 'recFAKELEAD000001',
      coupleNames: 'Fake Customer',
      eventDate: '2027-06-15',
      venue: 'Example Hall',
      address: '1 Example Street, Perth',
      packageName: 'Floor package',
      floor: { widthM: 6, lengthM: 4.5 },
      floorSqm: 27,
      screensBooked: 2,
      extras: ['live-event-streaming'],
    });

    const json = JSON.stringify(view);
    expect(json).not.toContain('INTERNAL-NOTE-DO-NOT-LEAK');
    expect(json).not.toContain('xero-admin');
    expect(json).not.toContain('evil.example');
    expect(json).not.toContain('fillout-secret');
    expect(json).not.toContain('0400000000');
    expect(json).not.toContain('9999');
    expect(json).not.toContain('Portal token');
  });

  it('falls back when the venue link has no name, and leaves unknown sqm without a size', () => {
    const view = mapPortalRecords(
      {
        id: 'recFAKEBOOK000001',
        fields: { 'Floor sqm': 15, 'Booking name': 'Name fallback' },
      },
      { id: 'recFAKELEAD000001', fields: { 'Venue name': 'Typed venue' } },
      null,
      DEFAULT_FIELD_NAMES,
      extras,
    );
    expect(view.booking.floor).toBeNull();
    expect(view.booking.floorSqm).toBe(15);
    expect(view.booking.venue).toBe('Typed venue');
    expect(view.booking.coupleNames).toBe('Name fallback');
    expect(view.booking.weddingPlanner).toBe('');
    expect(view.booking.photographer).toBe('');
    expect(view.booking.videographer).toBe('');
    expect(view.booking.dj).toBe('');
    expect(view.booking.otherSuppliers).toBe('');
  });

  it('maps supplier names when the booking record includes them', () => {
    const view = mapPortalRecords(
      {
        id: 'recFAKEBOOK000001',
        fields: {
          'Wedding planner': 'Ada Planner',
          Photographer: 'Cam Nguyen',
          Videographer: 'Priya Shah',
          DJ: 'Noah Ellis',
          'Other suppliers': 'Celebrant: Jo\nFlorist: Lane',
        },
      },
      null,
      null,
      DEFAULT_FIELD_NAMES,
      extras,
    );
    expect(view.booking.weddingPlanner).toBe('Ada Planner');
    expect(view.booking.photographer).toBe('Cam Nguyen');
    expect(view.booking.videographer).toBe('Priya Shah');
    expect(view.booking.dj).toBe('Noah Ellis');
    expect(view.booking.otherSuppliers).toBe('Celebrant: Jo\nFlorist: Lane');
    expect(view.booking.screensBooked).toBeNull();
  });

  it('trims and caps supplier prefill, and turns blank staff columns into blank boxes', () => {
    const view = mapPortalRecords(
      {
        id: 'recFAKEBOOK000001',
        fields: {
          'Wedding planner': '  Ada Planner  ',
          Photographer: ` ${'P'.repeat(200)} `,
          Videographer: '   ',
          DJ: '',
          'Other suppliers': `\n${'O'.repeat(2_500)}\n`,
          'Wedding Planners': ['recFAKEPLAN00001'],
          'Important notes': 'INTERNAL-NOTE-DO-NOT-LEAK',
          'Customer Xero account link': 'https://example.com/xero-admin-not-for-customers',
        },
      },
      null,
      null,
      DEFAULT_FIELD_NAMES,
      extras,
    );
    expect(view.booking.weddingPlanner).toBe('Ada Planner');
    expect(view.booking.photographer).toHaveLength(120);
    expect(view.booking.photographer).toBe('P'.repeat(120));
    expect(view.booking.videographer).toBe('');
    expect(view.booking.dj).toBe('');
    expect(view.booking.otherSuppliers).toHaveLength(2_000);
    expect(view.booking.otherSuppliers).toBe('O'.repeat(2_000));
    const json = JSON.stringify(view);
    expect(json).not.toContain('recFAKEPLAN00001');
    expect(json).not.toContain('Wedding Planners');
    expect(json).not.toContain('INTERNAL-NOTE-DO-NOT-LEAK');
    expect(json).not.toContain('xero-admin');
  });

  it('fetches the five supplier columns and leaves the old Wedding Planners field out', () => {
    const fetched = bookingFieldsToFetch(DEFAULT_FIELD_NAMES);
    expect(fetched).toEqual(
      expect.arrayContaining(['Wedding planner', 'Photographer', 'Videographer', 'DJ', 'Other suppliers']),
    );
    expect(fetched).not.toContain('Wedding Planners');
    expect(fetched).not.toContain('Important notes');
    expect(fetched).not.toContain('Customer Xero account link');
  });

  it('does not fetch private booking fields', () => {
    const fetched = bookingFieldsToFetch(DEFAULT_FIELD_NAMES);
    for (const name of PRIVATE_OR_UNUSED_FIELDS) expect(fetched).not.toContain(name);
  });
});
