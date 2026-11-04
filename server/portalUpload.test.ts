import { createServer, type Server } from 'node:http';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createAirtableClient } from '../src/lib/airtableClient';
import { DEFAULT_PORTAL_UPLOADS_FIELD_ID } from '../src/lib/airtableFields';
import { TOO_LARGE_MESSAGE } from '../src/lib/portalFiles';
import { readPortalConfig } from '../src/lib/portalConfig';
import { createApp } from './app';

const TOKEN = 'F'.repeat(43);
const KEEP = 'attKEEPALIVE00001';
const REMOVE = 'attREMOVE00000001';
const STORED = 'attUPLOADFILE0001';
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const servers: Server[] = [];
const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function start() {
  const calls: { url: string; method: string; body: string; auth: string }[] = [];
  const logs: string[] = [];
  const fetched: string[] = [];
  const client = createAirtableClient(
    readPortalConfig({
      AIRTABLE_TOKEN: 'pat_fake_not_real',
      PUBLIC_BASE_URL: 'https://stomp-portal.onrender.com',
    }),
    async (url, init) => {
      const method = init?.method ?? 'GET';
      const body = typeof init?.body === 'string' ? init.body : '';
      calls.push({
        url: String(url),
        method,
        body,
        auth: new Headers(init?.headers).get('Authorization') ?? '',
      });
      if (String(url).includes('/uploadAttachment')) {
        return Response.json({
          id: STORED,
          url: 'https://v5.airtableusercontent.com/do-not-leak',
          filename: 'Holding screen pre-bridal (tiny.png)',
          size: PNG.length,
          type: 'image/png',
        });
      }
      if (method === 'PATCH') return Response.json({ id: 'recFAKEBOOK000001' });
      return Response.json(airtableBody(String(url)));
    },
    (line) => logs.push(line),
  );

  const dir = await mkdtemp(path.join(tmpdir(), 'stomp-portal-'));
  dirs.push(dir);
  await writeFile(path.join(dir, 'index.html'), '<!doctype html><title>portal spa</title>', 'utf8');
  const app = createApp({
    config: readPortalConfig({
      AIRTABLE_TOKEN: 'pat_fake_not_real',
      PUBLIC_BASE_URL: 'https://stomp-portal.onrender.com',
    }),
    gateway: client,
    writer: client,
    staticDir: dir,
    fileFetch: async (url) => {
      fetched.push(String(url));
      if (String(url).includes('thumb')) return new Response(PNG, { headers: { 'content-type': 'image/jpeg' } });
      return new Response('nope', { status: 500 });
    },
  });
  const server = createServer(app);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('no port');
  return { base: `http://127.0.0.1:${address.port}`, calls, logs, fetched };
}

function airtableBody(url: string) {
  const parsed = new URL(url);
  if (parsed.pathname.endsWith('/Leads')) {
    return { records: [{ id: 'recFAKELEAD000001', fields: { Name: 'Fake Customer', Email: 'fake@example.com' } }] };
  }
  if (parsed.pathname.endsWith('/Venues')) {
    return { records: [{ id: 'recFAKEVENUE00001', fields: { 'Venue name': 'Example Hall' } }] };
  }
  if (parsed.searchParams.get('returnFieldsByFieldId') === 'true') {
    return {
      records: [
        {
          id: 'recFAKEBOOK000001',
          fields: {
            [DEFAULT_PORTAL_UPLOADS_FIELD_ID]: [
              {
                id: KEEP,
                url: 'https://v5.airtableusercontent.com/keep',
                filename: 'keep.jpg',
                type: 'image/jpeg',
                size: 10,
                thumbnails: { large: { url: 'https://v5.airtableusercontent.com/keep-thumb' } },
              },
              {
                id: REMOVE,
                url: 'https://v5.airtableusercontent.com/remove',
                filename: 'remove.jpg',
                type: 'image/jpeg',
                size: 12,
              },
            ],
          },
        },
      ],
    };
  }
  const formula = parsed.searchParams.get('filterByFormula') ?? '';
  if (!formula.includes(TOKEN)) return { records: [] };
  return {
    records: [
      {
        id: 'recFAKEBOOK000001',
        fields: {
          'Booking name': 'Fake celebration',
          Lead: ['recFAKELEAD000001'],
          'Event date': '2026-11-08',
          Venue: ['recFAKEVENUE00001'],
          'Floor sqm': 27,
        },
      },
    ],
  };
}

function form(role: string, bytes: Buffer, filename: string, type: string) {
  const body = new FormData();
  body.set('role', role);
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  body.set('file', new File([copy], filename, { type }), filename);
  return body;
}

describe('portal uploads', () => {
  it('stores a photo on Portal uploads and does not return the Airtable URL or the token', async () => {
    const { base, calls, logs } = await start();
    const res = await fetch(`${base}/api/portal/${TOKEN}/uploads`, {
      method: 'POST',
      body: form('holding-pre', PNG, 'tiny.png', 'image/png'),
    });
    expect(res.status).toBe(200);
    const payload = (await res.json()) as Record<string, unknown>;
    expect(payload.attachmentId).toBe(STORED);
    expect(payload).not.toHaveProperty('url');
    expect(JSON.stringify(payload)).not.toContain('airtableusercontent');
    expect(JSON.stringify(payload)).not.toContain('pat_fake_not_real');
    expect(JSON.stringify(payload)).not.toContain(TOKEN);

    const upload = calls.find((call) => call.url.includes('/uploadAttachment'));
    expect(upload?.method).toBe('POST');
    expect(upload?.url).toBe(
      `https://content.airtable.com/v0/appwMfJFb7rLDqJ30/recFAKEBOOK000001/${DEFAULT_PORTAL_UPLOADS_FIELD_ID}/uploadAttachment`,
    );
    expect(upload?.auth).toBe('Bearer pat_fake_not_real');
    const sent = JSON.parse(upload?.body ?? '{}') as { filename: string; contentType: string; file: string };
    expect(sent.filename).toBe('Holding screen pre-bridal (tiny.png)');
    expect(sent.contentType).toBe('image/png');
    expect(sent.file).toBe(PNG.toString('base64'));
    expect(logs.join('\n')).not.toContain('pat_fake_not_real');
    expect(logs.join('\n')).not.toContain('do-not-leak');
  });

  it('rejects a bad token and an oversized video with a real message', async () => {
    const { base, calls } = await start();
    const bad = await fetch(`${base}/api/portal/nope/uploads`, {
      method: 'POST',
      body: form('holding-pre', PNG, 'tiny.png', 'image/png'),
    });
    expect(bad.status).toBe(400);
    const badBody = (await bad.json()) as { message?: string };
    expect(badBody.message).toBeTruthy();

    const video = Buffer.alloc(6 * 1024 * 1024, 7);
    const over = await fetch(`${base}/api/portal/${TOKEN}/uploads`, {
      method: 'POST',
      body: form('media-end', video, 'dance.mp4', 'video/mp4'),
    });
    expect(over.status).toBe(413);
    expect(await over.json()).toMatchObject({ error: 'too_large', message: TOO_LARGE_MESSAGE });
    expect(calls.some((call) => call.url.includes('/uploadAttachment'))).toBe(false);
  });

  it('removes one attachment and keeps the others by id', async () => {
    const { base, calls } = await start();
    const res = await fetch(`${base}/api/portal/${TOKEN}/uploads/remove`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attachmentId: REMOVE }),
    });
    expect(res.status).toBe(200);
    const patch = calls.find((call) => call.method === 'PATCH' && call.body.includes(DEFAULT_PORTAL_UPLOADS_FIELD_ID));
    expect(JSON.parse(patch?.body ?? '{}')).toEqual({
      typecast: false,
      fields: { [DEFAULT_PORTAL_UPLOADS_FIELD_ID]: [{ id: KEEP }] },
    });
    expect(patch?.body).not.toContain(REMOVE);
  });

  it('proxies a fresh thumbnail and will not fetch a non Airtable URL', async () => {
    const { base, fetched } = await start();
    const res = await fetch(`${base}/api/portal/${TOKEN}/files/${KEEP}?variant=thumb`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('image/jpeg');
    expect(Buffer.from(await res.arrayBuffer()).equals(PNG)).toBe(true);
    expect(fetched).toEqual(['https://v5.airtableusercontent.com/keep-thumb']);
    expect(JSON.stringify(fetched)).not.toContain('pat_fake_not_real');

    const missing = await fetch(`${base}/api/portal/${TOKEN}/files/attDOESNOTEXIST01`);
    expect(missing.status).toBe(404);
  });
});
