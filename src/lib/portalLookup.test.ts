import { describe, expect, it } from 'vitest';
import { DEFAULT_FIELD_NAMES } from './airtableFields';
import type { AirtableRecord } from './bookingMap';
import { lookupBookingByToken, type AirtableGateway } from './portalLookup';
import { portalTokenFormula } from './portalToken';

const TOKEN = 'B'.repeat(43);
const extras = [{ id: 'live-event-streaming', name: 'Live event streaming' }];

function booking(fields: Record<string, unknown> = {}): AirtableRecord {
  return {
    id: 'recFAKEBOOK000001',
    fields: {
      'Booking name': 'Fake celebration',
      Lead: ['recFAKELEAD000001'],
      'Event date': '2027-06-15',
      Venue: ['recFAKEVENUE00001'],
      'Floor sqm': 12,
      'Important notes': 'INTERNAL-NOTE-DO-NOT-LEAK',
      'Customer Xero account link': 'https://example.com/xero-admin-not-for-customers',
      'Portal link': 'https://evil.example/p/stolen',
      ...fields,
    },
  };
}

function gateway(overrides: Partial<AirtableGateway> = {}): AirtableGateway & { formulas: string[]; leads: string[] } {
  const formulas: string[] = [];
  const leads: string[] = [];
  return {
    formulas,
    leads,
    async findBookingsByFormula(formula: string) {
      formulas.push(formula);
      return [booking()];
    },
    async getLead(id: string) {
      leads.push(id);
      return {
        id,
        fields: {
          Name: 'Fake Customer',
          Email: 'fake.customer@example.com',
          'Add-ons': ['Live event streaming'],
        },
      };
    },
    async getVenue(id: string) {
      return { id, fields: { 'Venue name': 'Example Hall' } };
    },
    ...overrides,
  };
}

function lookup(token: string, source: AirtableGateway, publicBaseUrl: string | null = 'https://stomp-portal.onrender.com') {
  return lookupBookingByToken(token, {
    gateway: source,
    tokenFieldName: 'Portal token',
    fields: DEFAULT_FIELD_NAMES,
    extras,
    publicBaseUrl,
  });
}

describe('token lookup', () => {
  it('returns one whitelisted booking for a valid token', async () => {
    const source = gateway();
    const result = await lookup(TOKEN, source);
    expect(source.formulas).toEqual([portalTokenFormula(TOKEN, 'Portal token')]);
    expect(source.leads).toEqual(['recFAKELEAD000001']);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.portal.booking.coupleNames).toBe('Fake Customer');
    expect(result.portal.booking.floor).toEqual({ widthM: 4, lengthM: 3 });
    expect(result.portal.booking.extras).toEqual(['live-event-streaming']);
    expect(result.portalUrl).toBe(`https://stomp-portal.onrender.com/p/${TOKEN}`);
    const json = JSON.stringify(result);
    expect(json).not.toContain('INTERNAL-NOTE-DO-NOT-LEAK');
    expect(json).not.toContain('xero-admin');
    expect(json).not.toContain('evil.example');
  });

  it('returns 404 for an unknown token and does not load linked records', async () => {
    const source = gateway({
      async findBookingsByFormula() {
        return [];
      },
    });
    const result = await lookup(TOKEN, source);
    expect(result).toEqual({ ok: false, status: 404, error: 'not_found' });
    expect(source.leads).toEqual([]);
  });

  it('returns 404 when more than one booking matches', async () => {
    const source = gateway({
      async findBookingsByFormula() {
        return [booking(), booking({ 'Booking name': 'Second fake' })];
      },
    });
    const result = await lookup(TOKEN, source);
    expect(result).toEqual({ ok: false, status: 404, error: 'not_found' });
    expect(source.leads).toEqual([]);
  });

  it('accepts a token when SMS added a trailing full stop', async () => {
    const source = gateway();
    const result = await lookup(`${TOKEN}.`, source);
    expect(result.ok).toBe(true);
    expect(source.formulas).toEqual([portalTokenFormula(TOKEN, 'Portal token')]);
  });

  it('returns a derived hire step and leaves staff Xero links off the payload', async () => {
    const source = gateway({
      async findBookingsByFormula() {
        return [
          booking({
            'Contract status': '',
            'Booking form URL used': 'https://go.xero.com/staff-form',
            'Deposit invoice link': 'https://go.xero.com/AccountsReceivable/View.aspx?InvoiceID=staff',
            'Final invoice link': 'https://in.xero.com/invoice/final',
            'Deposit status': 'Requested',
            'Balance status': 'Not due',
            'Customer Xero account link': 'https://go.xero.com/app/!staff',
          }),
        ];
      },
      async getLead(id: string) {
        return {
          id,
          fields: {
            Name: 'Fake Customer',
            Email: 'fake.customer@example.com',
            'Booking form link': 'https://forms.fillout.com/t/hire',
            'Terms accepted': false,
            'Booking form status': 'In progress',
          },
        };
      },
    });
    const result = await lookup(TOKEN, source);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.portal.booking.hire).toMatchObject({
      kind: 'both',
      actions: [
        { label: 'Sign hire terms', href: 'https://forms.fillout.com/t/hire' },
        { label: 'Pay now', href: 'https://in.xero.com/invoice/final' },
      ],
    });
    const json = JSON.stringify(result);
    expect(json).not.toContain('go.xero.com');
    expect(json).not.toContain('Customer Xero account link');
    expect(json).not.toContain('Deposit invoice link');
    expect(json).not.toContain('Contract status');
  });

  it('uses the neutral hire step when the lead cannot be read', async () => {
    const source = gateway({
      async findBookingsByFormula() {
        return [
          booking({
            'Contract status': 'Signed',
            'Deposit status': 'Paid',
            'Deposit invoice link': 'https://go.xero.com/staff-only',
          }),
        ];
      },
      async getLead() {
        throw new Error('Airtable request failed (503)');
      },
    });
    const result = await lookup(TOKEN, source);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.portal.booking.hire?.kind).toBe('unknown');
    expect(result.portal.booking.coupleNames).toBe('Fake celebration');
    expect(JSON.stringify(result)).not.toContain('go.xero.com');
  });

  it('stays neutral when the booking has no linked lead', async () => {
    const source = gateway({
      async findBookingsByFormula() {
        return [booking({ Lead: [] })];
      },
    });
    const result = await lookup(TOKEN, source);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.portal.booking.hire?.kind).toBe('unknown');
    expect(source.leads).toEqual([]);
  });

  it('rejects a malformed token before asking Airtable', async () => {
    const source = gateway();
    const hostile = "xxxxxxxxxxxxxxxxxxxxxx' OR NOT({Portal token}='')";
    const result = await lookup(hostile, source);
    expect(result).toEqual({ ok: false, status: 400, error: 'invalid_token' });
    expect(source.formulas).toEqual([]);
  });

  it('builds the formula with the quote escaped if a value is passed through', () => {
    expect(portalTokenFormula("abc'def", 'Portal token')).toBe("{Portal token} = 'abc\\'def'");
  });
});
