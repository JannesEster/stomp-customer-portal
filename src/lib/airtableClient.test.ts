import { describe, expect, it } from 'vitest';
import { createAirtableClient } from './airtableClient';
import { PORTAL_WRITE_FIELDS, PRIVATE_OR_UNUSED_FIELDS, pickPortalWriteFields } from './airtableFields';
import { readPortalConfig } from './portalConfig';
import { portalTokenFormula } from './portalToken';

const TOKEN = 'E'.repeat(43);

function config() {
  return readPortalConfig({
    AIRTABLE_TOKEN: 'pat_fake_not_real',
    PORTAL_TOKEN_FIELD_ID: 'fldBr9O48s8nRuxrm',
    PUBLIC_BASE_URL: 'https://stomp-portal.onrender.com',
  });
}

describe('Airtable client', () => {
  it('looks up with a formula, a two record cap, and no private fields', async () => {
    const calls: { url: string; auth: string }[] = [];
    const client = createAirtableClient(config(), async (url, init) => {
      calls.push({ url: String(url), auth: new Headers(init?.headers).get('Authorization') ?? '' });
      return Response.json({ records: [] });
    });

    await client.findBookingsByFormula(portalTokenFormula(TOKEN, 'Portal token'));

    const url = new URL(calls[0].url);
    expect(url.origin + url.pathname).toBe('https://api.airtable.com/v0/appwMfJFb7rLDqJ30/Bookings');
    expect(url.searchParams.get('filterByFormula')).toBe(`{Portal token} = '${TOKEN}'`);
    expect(url.searchParams.get('maxRecords')).toBe('2');
    const fields = url.searchParams.getAll('fields[]');
    expect(fields).toContain('Booking name');
    expect(fields).toContain('Portal answers');
    expect(fields).toContain('Portal last saved');
    expect(fields).toContain('Portal first opened');
    expect(fields).not.toContain('Portal summary');
    expect(fields).not.toContain('Portal floor preview');
    expect(fields).not.toContain('Important notes');
    expect(fields).not.toContain('Customer Xero account link');
    expect(fields).not.toContain('Portal link');
    expect(calls[0].auth).toBe('Bearer pat_fake_not_real');
  });

  it('refuses an empty filter and a bad record id', async () => {
    let called = false;
    const client = createAirtableClient(config(), async () => {
      called = true;
      return Response.json({ records: [] });
    });
    await expect(client.findBookingsByFormula('   ')).rejects.toThrow(/empty/i);
    expect(await client.getLead('not-a-record')).toBeNull();
    expect(await client.getBookingForTokenFill('not-a-record')).toBeNull();
    expect(called).toBe(false);
  });

  it('loads one booking through the list endpoint and only its portal token field', async () => {
    const calls: string[] = [];
    const client = createAirtableClient(config(), async (url) => {
      calls.push(String(url));
      return Response.json({ records: [{ id: 'recFAKEBOOK000001', fields: { 'Portal token': '' } }] });
    });
    const record = await client.getBookingForTokenFill('recFAKEBOOK000001');
    expect(record?.id).toBe('recFAKEBOOK000001');
    const url = new URL(calls[0]);
    expect(url.pathname).toBe('/v0/appwMfJFb7rLDqJ30/Bookings');
    expect(url.searchParams.get('filterByFormula')).toBe("RECORD_ID()='recFAKEBOOK000001'");
    expect(url.searchParams.get('maxRecords')).toBe('1');
    expect(url.searchParams.getAll('fields[]')).toEqual(['Portal token']);
    expect(url.search).not.toContain('Important');
  });

  it('loads a lead and a venue by record id with a field whitelist', async () => {
    const calls: string[] = [];
    const client = createAirtableClient(config(), async (url) => {
      calls.push(String(url));
      const id = new URL(String(url)).searchParams.get('filterByFormula')?.includes('LEAD')
        ? 'recFAKELEAD000001'
        : 'recFAKEVENUE00001';
      return Response.json({ records: [{ id, fields: { Name: 'Fake Guest' } }] });
    });

    expect((await client.getLead('recFAKELEAD000001'))?.id).toBe('recFAKELEAD000001');
    expect((await client.getVenue('recFAKEVENUE00001'))?.id).toBe('recFAKEVENUE00001');

    const lead = new URL(calls[0]);
    expect(lead.pathname).toBe('/v0/appwMfJFb7rLDqJ30/Leads');
    expect(lead.pathname).not.toContain('recFAKELEAD000001');
    expect(lead.searchParams.get('filterByFormula')).toBe("RECORD_ID()='recFAKELEAD000001'");
    expect(lead.searchParams.get('maxRecords')).toBe('1');
    expect(lead.searchParams.getAll('fields[]')).toEqual(['Name', 'Email', 'Add-ons', 'Venue name']);
    expect(lead.searchParams.getAll('fields[]')).not.toContain('Phone');
    expect(lead.search).not.toContain('Important notes');
    expect(lead.search).not.toContain('Xero');

    const venue = new URL(calls[1]);
    expect(venue.pathname).toBe('/v0/appwMfJFb7rLDqJ30/Venues');
    expect(venue.pathname).not.toContain('recFAKEVENUE00001');
    expect(venue.searchParams.get('filterByFormula')).toBe("RECORD_ID()='recFAKEVENUE00001'");
    expect(venue.searchParams.get('maxRecords')).toBe('1');
    expect(venue.searchParams.getAll('fields[]')).toEqual(['Venue name', 'Address']);
  });

  it('returns null when the list endpoint has no matching record', async () => {
    const client = createAirtableClient(config(), async () => Response.json({ records: [] }));
    expect(await client.getLead('recFAKELEAD000001')).toBeNull();
    expect(await client.getVenue('recFAKEVENUE00001')).toBeNull();
  });

  it('does not echo Airtable error bodies', async () => {
    const logs: string[] = [];
    const client = createAirtableClient(
      config(),
      async () =>
        Response.json(
          {
            error: {
              type: 'INVALID_REQUEST_UNKNOWN',
              message: `${TOKEN} fake.customer@example.com pat_fake_not_real filterByFormula`,
            },
          },
          { status: 422 },
        ),
      (line) => logs.push(line),
    );
    await expect(client.findBookingsByFormula(`{Portal token} = '${TOKEN}'`)).rejects.toThrow(
      'Airtable request failed (422)',
    );
    await expect(client.getLead('recFAKELEAD000001')).rejects.not.toThrow(/example.com|pat_fake/);
    expect(logs).toEqual([
      'airtable findBookings failed status=422 table=Bookings type=INVALID_REQUEST_UNKNOWN',
      'airtable getLead failed status=422 table=Leads type=INVALID_REQUEST_UNKNOWN',
    ]);
    const joined = logs.join('\n');
    expect(joined).not.toContain(TOKEN);
    expect(joined).not.toContain('pat_fake_not_real');
    expect(joined).not.toContain('example.com');
    expect(joined).not.toContain('filterByFormula');
  });

  it('drops an error type that is not a plain Airtable code', async () => {
    const logs: string[] = [];
    const client = createAirtableClient(
      config(),
      async () => Response.json({ error: { type: TOKEN, message: 'secret body' } }, { status: 422 }),
      (line) => logs.push(line),
    );
    await expect(client.getVenue('recFAKEVENUE00001')).rejects.toThrow('Airtable request failed (422)');
    expect(logs).toEqual(['airtable getVenue failed status=422 table=Venues type=unknown']);
    expect(logs[0]).not.toContain(TOKEN);
  });

  it('lists only blank tokens and writes only the token field', async () => {
    const calls: { url: string; method: string; body: string }[] = [];
    const client = createAirtableClient(config(), async (url, init) => {
      calls.push({ url: String(url), method: init?.method ?? 'GET', body: typeof init?.body === 'string' ? init.body : '' });
      const parsed = new URL(String(url));
      if ((init?.method ?? 'GET') === 'GET' && !parsed.searchParams.get('offset')) {
        return Response.json({
          records: [{ id: 'recFAKEBOOK000001', fields: {} }],
          offset: 'page2',
        });
      }
      if ((init?.method ?? 'GET') === 'GET') return Response.json({ records: [{ id: 'recFAKELEAD000001' }] });
      return Response.json({ records: [] });
    });

    const listed = await client.listBookingsForTokenFill();
    expect(listed.map((row) => row.id)).toEqual(['recFAKEBOOK000001', 'recFAKELEAD000001']);
    const listUrl = new URL(calls[0].url);
    expect(listUrl.searchParams.get('filterByFormula')).toBe('{Portal token} = BLANK()');
    expect(listUrl.searchParams.getAll('fields[]')).toEqual(['Portal token']);
    expect(new URL(calls[1].url).searchParams.get('offset')).toBe('page2');

    await client.writePortalTokens([
      {
        id: 'recFAKEBOOK000001',
        fields: {
          fldBr9O48s8nRuxrm: TOKEN,
          'Portal link': 'https://evil.example/p/nope',
          'Important notes': 'nope',
        },
      },
    ]);
    const body = JSON.parse(calls[2].body) as { records: { id: string; fields: Record<string, string> }[] };
    expect(calls[2].method).toBe('PATCH');
    expect(body).toEqual({ records: [{ id: 'recFAKEBOOK000001', fields: { fldBr9O48s8nRuxrm: TOKEN } }] });
    expect(calls[2].body).not.toContain('Portal link');
    expect(calls[2].body).not.toContain('evil.example');
    expect(calls[2].body).not.toContain('Important notes');
  });

  it('patches only portal write fields, with typecast off, and drops anything else', async () => {
    const calls: { url: string; method: string; body: string }[] = [];
    const client = createAirtableClient(config(), async (url, init) => {
      calls.push({
        url: String(url),
        method: init?.method ?? 'GET',
        body: typeof init?.body === 'string' ? init.body : '',
      });
      return Response.json({ id: 'recFAKEBOOK000001', fields: {} });
    });

    const extra = {
      'Portal answers': '{"version":3}',
      'Portal summary': 'Holding screen: not set yet',
      'Portal progress': 0.5,
      'Important notes': 'LEAK-ME',
      'Portal token': TOKEN,
      'Customer Xero account link': 'https://example.com/xero-admin-not-for-customers',
      'Portal link': 'https://evil.example/p/nope',
    };
    await client.patchBooking('recFAKEBOOK000001', extra);
    await client.patchBooking('recFAKEBOOK000001', { 'Important notes': 'LEAK-ME', Phone: '0400000000' });

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('PATCH');
    expect(new URL(calls[0].url).pathname).toBe('/v0/appwMfJFb7rLDqJ30/Bookings/recFAKEBOOK000001');
    const body = JSON.parse(calls[0].body) as { typecast: boolean; fields: Record<string, unknown> };
    expect(body.typecast).toBe(false);
    expect(Object.keys(body.fields).every((key) => (PORTAL_WRITE_FIELDS as readonly string[]).includes(key))).toBe(true);
    expect(body.fields).toEqual({
      'Portal answers': '{"version":3}',
      'Portal summary': 'Holding screen: not set yet',
      'Portal progress': 0.5,
    });
    expect(calls[0].body).not.toContain('LEAK-ME');
    expect(calls[0].body).not.toContain(TOKEN);
    expect(calls[0].body).not.toContain('xero-admin');
    expect(calls[0].body).not.toContain('evil.example');

    const forbidden = [
      ...PRIVATE_OR_UNUSED_FIELDS,
      'Portal token',
      'Phone',
      'secretNote',
      'fields',
      'typecast',
    ];
    const attacked = Object.fromEntries(forbidden.map((name) => [name, 'nope']));
    expect(Object.keys(pickPortalWriteFields({ ...attacked, 'Portal last saved': '2026-01-01T00:00:00.000Z' }))).toEqual([
      'Portal last saved',
    ]);
    for (const name of forbidden) {
      expect(Object.keys(pickPortalWriteFields({ [name]: 'nope' }))).toEqual([]);
    }
  });

  it('uploads a floor preview PNG to the attachment endpoint and logs a forbidden write without the body', async () => {
    const calls: { url: string; method: string; body: string; auth: string }[] = [];
    const logs: string[] = [];
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    let status = 200;
    const client = createAirtableClient(
      config(),
      async (url, init) => {
        calls.push({
          url: String(url),
          method: init?.method ?? 'GET',
          body: typeof init?.body === 'string' ? init.body : '',
          auth: new Headers(init?.headers).get('Authorization') ?? '',
        });
        return Response.json(
          { error: { type: 'INVALID_PERMISSIONS', message: `${TOKEN} secret answers` } },
          { status },
        );
      },
      (line) => logs.push(line),
    );

    status = 200;
    await client.uploadFloorPreview('recFAKEBOOK000001', { base64: png, filename: 'floor-holding.png' });
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toBe(
      'https://content.airtable.com/v0/appwMfJFb7rLDqJ30/recFAKEBOOK000001/Portal%20floor%20preview/uploadAttachment',
    );
    expect(calls[0].auth).toBe('Bearer pat_fake_not_real');
    expect(JSON.parse(calls[0].body)).toEqual({ contentType: 'image/png', file: png, filename: 'floor-holding.png' });

    status = 403;
    await expect(
      client.uploadFloorPreview('recFAKEBOOK000001', { base64: png, filename: 'floor-dancing.png' }),
    ).rejects.toThrow('Airtable request failed (403)');
    expect(logs).toEqual(['airtable update forbidden status=403']);
    expect(logs.join('\n')).not.toContain(TOKEN);
    expect(logs.join('\n')).not.toContain('secret answers');
    expect(logs.join('\n')).not.toContain(png);
  });
});
