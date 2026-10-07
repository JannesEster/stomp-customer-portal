import { describe, expect, it } from 'vitest';
import { createAirtableClient } from './airtableClient';
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

  it('loads one booking and only its portal token field', async () => {
    const calls: string[] = [];
    const client = createAirtableClient(config(), async (url) => {
      calls.push(String(url));
      return Response.json({ id: 'recFAKEBOOK000001', fields: { 'Portal token': '' } });
    });
    const record = await client.getBookingForTokenFill('recFAKEBOOK000001');
    expect(record?.id).toBe('recFAKEBOOK000001');
    const url = new URL(calls[0]);
    expect(url.pathname).toBe('/v0/appwMfJFb7rLDqJ30/Bookings/recFAKEBOOK000001');
    expect(url.searchParams.getAll('fields[]')).toEqual(['Portal token']);
    expect(url.search).not.toContain('Important');
  });

  it('does not echo Airtable error bodies', async () => {
    const client = createAirtableClient(config(), async () => {
      return Response.json({ error: { message: 'fake.customer@example.com INTERNAL-NOTE-DO-NOT-LEAK' } }, { status: 422 });
    });
    await expect(client.findBookingsByFormula("{Portal token} = 'x'")).rejects.toThrow('Airtable request failed (422)');
    await expect(client.findBookingsByFormula("{Portal token} = 'x'")).rejects.not.toThrow(/example.com/);
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
});
