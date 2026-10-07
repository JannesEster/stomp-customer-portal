import { createServer, type Server } from 'node:http';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { AirtableRecord } from '../src/lib/bookingMap';
import type { AirtableGateway } from '../src/lib/portalLookup';
import { readPortalConfig } from '../src/lib/portalConfig';
import { createApp } from './app';

const TOKEN = 'F'.repeat(43);

const servers: Server[] = [];
const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function start(gateway: AirtableGateway | null, rateLimit?: { windowMs: number; max: number }) {
  const dir = await mkdtemp(path.join(tmpdir(), 'stomp-portal-'));
  dirs.push(dir);
  await writeFile(path.join(dir, 'index.html'), '<!doctype html><title>portal spa</title>', 'utf8');
  const app = createApp({
    config: readPortalConfig({
      AIRTABLE_TOKEN: gateway ? 'pat_fake_not_real' : undefined,
      PUBLIC_BASE_URL: 'https://stomp-portal.onrender.com',
    }),
    gateway,
    staticDir: dir,
    rateLimit,
  });
  const server = createServer(app);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('no port');
  return `http://127.0.0.1:${address.port}`;
}

function okGateway(): AirtableGateway {
  return {
    async findBookingsByFormula(): Promise<AirtableRecord[]> {
      return [
        {
          id: 'recFAKEBOOK000001',
          fields: {
            'Booking name': 'Fake celebration',
            Lead: ['recFAKELEAD000001'],
            'Event date': '2027-06-15',
            Venue: ['recFAKEVENUE00001'],
            'Floor sqm': 27,
            'Important notes': 'INTERNAL-NOTE-DO-NOT-LEAK',
            'Customer Xero account link': 'https://example.com/xero-admin-not-for-customers',
          },
        },
      ];
    },
    async getLead(id) {
      return {
        id,
        fields: { Name: 'Fake Customer', Email: 'fake.customer@example.com', 'Add-ons': ['2 portrait screens'] },
      };
    },
    async getVenue(id) {
      return { id, fields: { 'Venue name': 'Example Hall' } };
    },
  };
}

describe('portal HTTP API', () => {
  it('serves health and the SPA for a token link', async () => {
    const base = await start(null);
    const health = await fetch(`${base}/healthz`);
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ ok: true });

    const page = await fetch(`${base}/p/${TOKEN}`);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('portal spa');
    expect((await fetch(`${base}/missing-file.js`)).status).toBe(404);
    expect((await fetch(`${base}/api/bookings`)).status).toBe(404);
  });

  it('returns the whitelisted booking for a valid token', async () => {
    const base = await start(okGateway());
    const res = await fetch(`${base}/api/portal/${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = await res.json();
    expect(body.booking.coupleNames).toBe('Fake Customer');
    expect(body.booking.floor).toEqual({ widthM: 6, lengthM: 4.5 });
    expect(body.booking.screensBooked).toBe(2);
    expect(body.portalUrl).toBe(`https://stomp-portal.onrender.com/p/${TOKEN}`);
    const json = JSON.stringify(body);
    expect(json).not.toContain('INTERNAL-NOTE-DO-NOT-LEAK');
    expect(json).not.toContain('xero-admin');
  });

  it('returns 404 for an unknown token and 400 for a malformed one', async () => {
    let calls = 0;
    const base = await start({
      async findBookingsByFormula() {
        calls += 1;
        return [];
      },
      async getLead() {
        return null;
      },
      async getVenue() {
        return null;
      },
    });
    const unknown = await fetch(`${base}/api/portal/${TOKEN}`);
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toEqual({ error: 'not_found' });

    const malformed = await fetch(`${base}/api/portal/${encodeURIComponent("short' OR TRUE()")}`);
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toEqual({ error: 'invalid_token' });
    expect(calls).toBe(1);
  });

  it('rate limits token lookups', async () => {
    let calls = 0;
    const base = await start(
      {
        async findBookingsByFormula() {
          calls += 1;
          return [];
        },
        async getLead() {
          return null;
        },
        async getVenue() {
          return null;
        },
      },
      { windowMs: 60_000, max: 2 },
    );
    expect((await fetch(`${base}/api/portal/${TOKEN}`)).status).toBe(404);
    expect((await fetch(`${base}/api/portal/${TOKEN}`)).status).toBe(404);
    const blocked = await fetch(`${base}/api/portal/${TOKEN}`);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('retry-after')).toBe('60');
    expect(calls).toBe(2);
  });

  it('hides upstream error details', async () => {
    const base = await start({
      async findBookingsByFormula() {
        throw new Error('fake.customer@example.com INTERNAL-NOTE-DO-NOT-LEAK');
      },
      async getLead() {
        return null;
      },
      async getVenue() {
        return null;
      },
    });
    const res = await fetch(`${base}/api/portal/${TOKEN}`);
    expect(res.status).toBe(502);
    const json = JSON.stringify(await res.json());
    expect(json).not.toContain('example.com');
    expect(json).not.toContain('INTERNAL-NOTE');
  });
});
