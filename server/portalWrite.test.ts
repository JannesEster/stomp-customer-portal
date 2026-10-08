import { createServer, type Server } from 'node:http';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAirtableClient } from '../src/lib/airtableClient';
import { PORTAL_WRITE_FIELDS } from '../src/lib/airtableFields';
import { createDefaultDesign } from '../src/lib/design';
import { sanitizePortalAnswers } from '../src/lib/portalAnswers';
import { readPortalConfig } from '../src/lib/portalConfig';
import { floorDesignLabel, portalStepReport, portalSummary, supplierLines } from '../src/lib/portalProgress';
import { createApp } from './app';
import type { DesignState } from '../src/types';

const TOKEN = 'F'.repeat(43);
const PNG_1X1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const servers: Server[] = [];
const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

interface FetchOpts {
  addOns?: string[];
  firstOpened?: string;
  answers?: string;
  lastSaved?: string;
  summary?: string;
  writeStatus?: number;
}

function postedDesign(): DesignState {
  const design = createDefaultDesign({ coupleNames: 'Fake Customer' }, new Date('2026-04-01T00:00:00.000Z'));
  design.designs.holding = {
    styleId: 'gold-rings',
    names: 'Fake Customer',
    media: { id: 'filefake00000001', name: 'hands.jpg', type: 'image/jpeg', size: 1200 },
  };
  return design;
}

async function start(opts: FetchOpts = {}, limits?: { writeMax?: number; previewMax?: number }) {
  const calls: { url: string; method: string; body: string }[] = [];
  const logs: string[] = [];
  const client = createAirtableClient(
    readPortalConfig({
      AIRTABLE_TOKEN: 'pat_fake_not_real',
      PUBLIC_BASE_URL: 'https://stomp-portal.onrender.com',
    }),
    async (url, init) => {
      const method = init?.method ?? 'GET';
      const body = typeof init?.body === 'string' ? init.body : '';
      calls.push({ url: String(url), method, body });
      if (opts.writeStatus && (method === 'PATCH' || String(url).includes('content.airtable.com'))) {
        return Response.json(
          { error: { type: 'INVALID_PERMISSIONS_OR_MODEL_NOT_FOUND', message: `${TOKEN} secret answers` } },
          { status: opts.writeStatus },
        );
      }
      if (String(url).includes('content.airtable.com')) return Response.json({ id: 'attFAKE000000001' });
      if (method === 'PATCH') return Response.json({ id: 'recFAKEBOOK000001' });
      return Response.json(getBody(String(url), opts));
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
    writeRateLimit: { windowMs: 60_000, max: limits?.writeMax ?? 20 },
    previewRateLimit: { windowMs: 10 * 60_000, max: limits?.previewMax ?? 6 },
  });
  const server = createServer(app);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('no port');
  return { base: `http://127.0.0.1:${address.port}`, calls, logs };
}

function getBody(url: string, opts: FetchOpts) {
  const parsed = new URL(url);
  if (parsed.pathname.endsWith('/Leads')) {
    return {
      records: [
        {
          id: 'recFAKELEAD000001',
          fields: {
            Name: 'Fake Customer',
            Email: 'fake.customer@example.com',
            'Add-ons': opts.addOns ?? ['2 portrait screens'],
          },
        },
      ],
    };
  }
  if (parsed.pathname.endsWith('/Venues')) {
    return { records: [{ id: 'recFAKEVENUE00001', fields: { 'Venue name': 'Example Hall' } }] };
  }
  const formula = parsed.searchParams.get('filterByFormula') ?? '';
  if (!formula.includes(TOKEN)) return { records: [] };
  const fields: Record<string, unknown> = {
    'Booking name': 'Fake celebration',
    Lead: ['recFAKELEAD000001'],
    'Event date': '2027-06-15',
    Venue: ['recFAKEVENUE00001'],
    'Floor sqm': 27,
    'Important notes': 'INTERNAL-NOTE-DO-NOT-LEAK',
  };
  if (opts.firstOpened) fields['Portal first opened'] = opts.firstOpened;
  if (opts.answers) fields['Portal answers'] = opts.answers;
  if (opts.lastSaved) fields['Portal last saved'] = opts.lastSaved;
  if (opts.summary) fields['Portal summary'] = opts.summary;
  return { records: [{ id: 'recFAKEBOOK000001', fields }] };
}

function patches(calls: { method: string; body: string }[]) {
  return calls.filter((call) => call.method === 'PATCH').map((call) => JSON.parse(call.body) as {
    typecast: boolean;
    fields: Record<string, unknown>;
  });
}

describe('portal answer writes', () => {
  it('patches exactly the portal fields for one booking and strips extra keys', async () => {
    const { base, calls, logs } = await start({ addOns: ['2 portrait screens'] });
    const design = postedDesign();
    const res = await fetch(`${base}/api/portal/${TOKEN}/answers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        answers: { ...design, secretNote: 'LEAK-ME' },
        progress: 1,
        'Important notes': 'LEAK-ME',
        'Portal token': TOKEN,
      }),
    });
    expect(res.status).toBe(200);
    const saved = sanitizePortalAnswers(design, 'Fake Customer');
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    const report = portalStepReport(saved.design, 2);
    const body = patches(calls)[0];
    expect(body.typecast).toBe(false);
    expect(Object.keys(body.fields).every((key) => (PORTAL_WRITE_FIELDS as readonly string[]).includes(key))).toBe(true);
    expect(body.fields['Portal answers']).toBe(JSON.stringify(saved.design));
    expect(body.fields['Portal answers']).not.toContain('secretNote');
    expect(body.fields['Portal answers']).not.toContain('LEAK-ME');
    expect(body.fields['Portal summary']).toBe(portalSummary(saved.design, 2));
    expect(body.fields['Portal progress']).toBe(report.progress);
    expect(body.fields['Portal progress']).not.toBe(1);
    expect(body.fields['Portal steps missing']).toBe(report.missing.join(', '));
    expect(body.fields['Portal steps missing']).toContain('Your screen design');
    expect(body.fields['Portal floor design']).toBe(floorDesignLabel(saved.design));
    expect(body.fields['Portal suppliers']).toBe('');
    expect(body.fields['Portal last saved']).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(body.fields['Portal first opened']).toBe(body.fields['Portal last saved']);
    expect(body.fields).not.toHaveProperty('Important notes');
    expect(body.fields).not.toHaveProperty('Portal token');
    expect(body.fields).not.toHaveProperty('Portal floor preview');
    expect(JSON.stringify(body)).not.toContain('LEAK-ME');
    expect(JSON.stringify(body)).not.toContain(TOKEN);
    expect(logs.join('\n')).not.toContain(TOKEN);

    const alias = await fetch(`${base}/api/p/${TOKEN}/answers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: design }),
    });
    expect(alias.status).toBe(200);
    expect(patches(calls)).toHaveLength(2);
  });

  it('writes Portal suppliers for filled roles and leaves progress unchanged', async () => {
    const { base, calls } = await start({ addOns: ['2 portrait screens'] });
    const design = postedDesign();
    design.weddingPlanner = '  Ada Planner  ';
    design.photographer = '   ';
    design.videographer = 'Priya Shah';
    design.dj = '';
    design.otherSuppliers = ' Celebrant: Jo\nFlorist: Lane ';
    const res = await fetch(`${base}/api/portal/${TOKEN}/answers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        answers: design,
        'Important notes': 'LEAK-ME',
        'Customer Xero account link': 'https://example.com/xero-admin-not-for-customers',
      }),
    });
    expect(res.status).toBe(200);
    const saved = sanitizePortalAnswers(design, 'Fake Customer');
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    const withoutSuppliers = postedDesign();
    const body = patches(calls)[0];
    expect(body.fields['Portal suppliers']).toBe(supplierLines(saved.design));
    expect(body.fields['Portal suppliers']).toBe(
      'Wedding planner: Ada Planner\nVideographer: Priya Shah\nOther: Celebrant: Jo\nFlorist: Lane',
    );
    expect(body.fields['Portal summary']).toContain('People on the day');
    expect(body.fields['Portal summary']).toContain('Wedding planner: Ada Planner');
    expect(String(body.fields['Portal summary'])).not.toContain('Photographer');
    expect(body.fields['Portal progress']).toBe(portalStepReport(withoutSuppliers, 2).progress);
    expect(body.fields['Portal steps missing']).toBe(portalStepReport(withoutSuppliers, 2).missing.join(', '));
    expect(body.fields).not.toHaveProperty('Important notes');
    expect(body.fields).not.toHaveProperty('Customer Xero account link');
    expect(body.fields).not.toHaveProperty('Wedding planner');
    expect(JSON.stringify(body)).not.toContain('LEAK-ME');
    expect(JSON.stringify(body)).not.toContain('xero-admin');
  });

  it('leaves Portal first opened alone when it is already set, and stamps only that field on open', async () => {
    const opened = '2024-01-02T03:04:05.000Z';
    const { base, calls } = await start({ firstOpened: opened, addOns: ['No screens'] });
    const saved = await fetch(`${base}/api/portal/${TOKEN}/answers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: postedDesign() }),
    });
    expect(saved.status).toBe(200);
    const answerPatch = patches(calls)[0];
    expect(answerPatch.fields).not.toHaveProperty('Portal first opened');
    expect(JSON.stringify(answerPatch)).not.toContain(opened);
    const missing = String(answerPatch.fields['Portal steps missing']);
    expect(missing).not.toContain('Your screen design');
    expect(missing).not.toContain('Screens before the entrance');
    expect(missing).not.toContain('Screens after the entrance');
    expect(missing).not.toContain('Screens during the dancing');

    const again = await fetch(`${base}/api/portal/${TOKEN}/opened`, { method: 'POST' });
    expect(again.status).toBe(200);
    expect(patches(calls)).toHaveLength(1);

    const fresh = await start({ addOns: ['No screens'] });
    const first = await fetch(`${fresh.base}/api/p/${TOKEN}/opened`, { method: 'POST' });
    expect(first.status).toBe(200);
    const openPatch = patches(fresh.calls)[0];
    expect(openPatch).toEqual({
      typecast: false,
      fields: { 'Portal first opened': openPatch.fields['Portal first opened'] },
    });
    expect(openPatch.fields['Portal first opened']).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(Object.keys(openPatch.fields)).toEqual(['Portal first opened']);
  });

  it('returns 404 for an unknown token and 400 for a bad token or bad answers, and writes nothing', async () => {
    const { base, calls } = await start();
    const unknown = await fetch(`${base}/api/portal/${'A'.repeat(43)}/answers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: postedDesign() }),
    });
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toEqual({ error: 'not_found' });

    const malformed = await fetch(`${base}/api/portal/short/answers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: postedDesign() }),
    });
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toEqual({ error: 'invalid_token' });

    const bad = await fetch(`${base}/api/portal/${TOKEN}/answers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: { version: 3, reactions: 'nope' } }),
    });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: 'invalid_answers' });
    expect(patches(calls)).toEqual([]);
    expect(calls.some((call) => call.url.includes('short'))).toBe(false);
  });

  it('returns 413 when the answers body is over the route limit', async () => {
    const { base, calls } = await start();
    const res = await fetch(`${base}/api/portal/${TOKEN}/answers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: { blob: 'x'.repeat(70_000) } }),
    });
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'payload_too_large' });
    expect(calls).toEqual([]);
  });

  it('rate limits writes per IP and token', async () => {
    const { base, calls } = await start({}, { writeMax: 2 });
    const post = () =>
      fetch(`${base}/api/portal/${TOKEN}/answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: { version: 1 } }),
      });
    expect((await post()).status).toBe(400);
    expect((await post()).status).toBe(400);
    const blocked = await post();
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('retry-after')).toBe('60');
    expect(await blocked.json()).toEqual({ error: 'rate_limited' });
    expect(patches(calls)).toEqual([]);
  });

  it('returns saved answers on GET and hides the staff-only fields', async () => {
    const design = postedDesign();
    design.weddingPlanner = 'Ada Planner';
    design.dj = 'Noah Ellis';
    design.otherSuppliers = 'Celebrant: Jo\nFlorist: Lane';
    const { base } = await start({
      answers: JSON.stringify({ ...design, secretNote: 'drop-on-read' }),
      lastSaved: '2026-05-01T00:00:00.000Z',
      firstOpened: '1999-01-01T00:00:00.000Z',
      summary: 'SUMMARY-NOT-FOR-CLIENT',
    });
    const res = await fetch(`${base}/api/portal/${TOKEN}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.savedAnswers.designs.holding.styleId).toBe('gold-rings');
    expect(body.savedAnswers.weddingPlanner).toBe('Ada Planner');
    expect(body.savedAnswers.dj).toBe('Noah Ellis');
    expect(body.savedAnswers.otherSuppliers).toBe('Celebrant: Jo\nFlorist: Lane');
    expect(body.savedAnswers.secretNote).toBe('drop-on-read');
    expect(body).not.toHaveProperty('Portal suppliers');
    expect(body.lastSavedAt).toBe('2026-05-01T00:00:00.000Z');
    expect(body).not.toHaveProperty('firstOpenedAt');
    const json = JSON.stringify(body);
    expect(json).not.toContain('SUMMARY-NOT-FOR-CLIENT');
    expect(json).not.toContain('1999-01-01');
    expect(json).not.toContain('Portal progress');
    expect(json).not.toContain('Portal steps missing');
    expect(json).not.toContain('INTERNAL-NOTE');

    const blank = await start({ answers: 'not json' });
    const empty = await fetch(`${blank.base}/api/portal/${TOKEN}`);
    const emptyBody = await empty.json();
    expect(emptyBody.savedAnswers).toBeNull();
    expect(emptyBody.lastSavedAt).toBeNull();
  });

  it('maps an Airtable 403 on write to write_forbidden', async () => {
    const logs: string[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((line?: unknown) => {
      logs.push(String(line));
    });
    try {
      const { base, logs: clientLogs } = await start({ writeStatus: 403 });
      const res = await fetch(`${base}/api/portal/${TOKEN}/answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: postedDesign() }),
      });
      expect(res.status).toBe(502);
      expect(await res.json()).toEqual({ error: 'write_forbidden' });
      expect(clientLogs).toContain('airtable update forbidden status=403');
      const joined = [...clientLogs, ...logs].join('\n');
      expect(joined).not.toContain(TOKEN);
      expect(joined).not.toContain('secret answers');
      expect(joined).not.toContain('gold-rings');
      expect(joined).not.toContain('Fake Customer');
    } finally {
      spy.mockRestore();
    }
  });
});

describe('portal floor preview writes', () => {
  it('clears the attachment field and uploads a PNG to the content endpoint', async () => {
    const { base, calls } = await start();
    const res = await fetch(`${base}/api/portal/${TOKEN}/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        images: [
          { phase: 'holding', png: `data:image/png;base64,${PNG_1X1}` },
          { phase: 'dancing', png: PNG_1X1 },
        ],
      }),
    });
    expect(res.status).toBe(200);
    const patch = patches(calls)[0];
    expect(patch).toEqual({ typecast: false, fields: { 'Portal floor preview': [] } });
    expect(Object.keys(patch.fields)).toEqual(['Portal floor preview']);
    const uploads = calls.filter((call) => call.url.includes('content.airtable.com'));
    expect(uploads).toHaveLength(2);
    expect(uploads[0].url).toBe(
      'https://content.airtable.com/v0/appwMfJFb7rLDqJ30/recFAKEBOOK000001/Portal%20floor%20preview/uploadAttachment',
    );
    expect(JSON.parse(uploads[0].body)).toEqual({
      contentType: 'image/png',
      file: PNG_1X1,
      filename: 'floor-holding.png',
    });
    expect(JSON.parse(uploads[1].body).filename).toBe('floor-dancing.png');
    expect(uploads[0].body).not.toContain(TOKEN);
  });

  it('rejects a non PNG and an oversized preview before writing', async () => {
    const { base, calls } = await start();
    const bad = await fetch(`${base}/api/portal/${TOKEN}/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images: [{ phase: 'holding', png: 'aGVsbG8=' }] }),
    });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: 'invalid_preview' });

    const raw = Buffer.alloc(Math.floor(1.5 * 1024 * 1024) + 32);
    raw.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const over = await fetch(`${base}/api/portal/${TOKEN}/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ png: raw.toString('base64') }),
    });
    expect(over.status).toBe(413);
    expect(await over.json()).toEqual({ error: 'payload_too_large' });
    expect(patches(calls)).toEqual([]);
    expect(calls.filter((call) => call.url.includes('content.airtable.com'))).toEqual([]);
  });

  it('caps preview uploads per token and maps 403 to write_forbidden', async () => {
    const { base } = await start({}, { previewMax: 2 });
    const post = () =>
      fetch(`${base}/api/portal/${TOKEN}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ png: PNG_1X1 }),
      });
    expect((await post()).status).toBe(200);
    expect((await post()).status).toBe(200);
    const blocked = await post();
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('retry-after')).toBe('600');

    const denied = await start({ writeStatus: 403 });
    const logs: string[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((line?: unknown) => {
      logs.push(String(line));
    });
    try {
      const res = await fetch(`${denied.base}/api/portal/${TOKEN}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ png: PNG_1X1 }),
      });
      expect(res.status).toBe(502);
      expect(await res.json()).toEqual({ error: 'write_forbidden' });
      expect(denied.logs).toContain('airtable update forbidden status=403');
      expect([...denied.logs, ...logs].join('\n')).not.toContain(TOKEN);
    } finally {
      spy.mockRestore();
    }
  });
});
