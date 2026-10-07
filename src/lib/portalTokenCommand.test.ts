import { describe, expect, it } from 'vitest';
import {
  executePortalTokens,
  isAirtableRecordId,
  parsePortalTokenArgs,
  planRecordToken,
  portalUrlForToken,
  redactSecret,
} from './portalTokenCommand';
import type { TokenPatch, TokenRecord } from './tokenBatch';

const SECRET = 'pat_fake_not_real';
const EXISTING = 'C'.repeat(43);
const GENERATED = 'D'.repeat(43);
const BASE = 'https://stomp-portal.onrender.com';
const RECORD = 'recFAKEBOOK000001';

function harness(argv: string[], record: TokenRecord | null, extras: { list?: () => Promise<TokenRecord[]> } = {}) {
  const logs: string[] = [];
  const errors: string[] = [];
  const patches: TokenPatch[] = [];
  let listed = false;
  let fetched: string | null = null;
  const run = () =>
    executePortalTokens({
      argv,
      publicBaseUrl: BASE,
      tokenFieldName: 'Portal token',
      fieldKey: 'fldBr9O48s8nRuxrm',
      airtableTokenSet: true,
      secret: SECRET,
      listMissing: extras.list ?? (async () => {
        listed = true;
        return [];
      }),
      getRecord: async (id) => {
        fetched = id;
        return record;
      },
      writeTokens: async (next) => {
        patches.push(...next);
      },
      log: (line) => logs.push(line),
      error: (line) => errors.push(line),
      generateToken: () => GENERATED,
    });
  return { logs, errors, patches, run, didList: () => listed, fetched: () => fetched };
}

describe('portal token arguments', () => {
  it('accepts one record id and rejects anything else', () => {
    expect(isAirtableRecordId(RECORD)).toBe(true);
    expect(isAirtableRecordId('recFAKEBOOK00001')).toBe(false);
    expect(isAirtableRecordId('recFAKEBOOK0000011')).toBe(false);
    expect(isAirtableRecordId('notARecordId0001')).toBe(false);
    expect(parsePortalTokenArgs(['--record', RECORD])).toEqual({ ok: true, help: false, write: false, recordId: RECORD });
    expect(parsePortalTokenArgs(['--record', RECORD, '--write'])).toMatchObject({ write: true, recordId: RECORD });
    expect(parsePortalTokenArgs(['--record', 'recSHORT'])).toMatchObject({ ok: false });
    expect(parsePortalTokenArgs(['--record'])).toMatchObject({ ok: false });
    expect(parsePortalTokenArgs(['--record', SECRET])).toMatchObject({ ok: false });
    const bad = parsePortalTokenArgs(['--record', SECRET]);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).not.toContain(SECRET);
  });
});

describe('--record token fill', () => {
  it('dry run on a blank booking writes nothing and prints no URL', async () => {
    const run = harness(['--record', RECORD], { id: RECORD, fields: { 'Portal token': '  ' } });
    expect(await run.run()).toBe(0);
    expect(run.patches).toEqual([]);
    expect(run.didList()).toBe(false);
    expect(run.fetched()).toBe(RECORD);
    const text = run.logs.join('\n');
    expect(text).toContain('Dry run');
    expect(text).toContain('No records were changed');
    expect(text).not.toContain('/p/');
    expect(text).not.toContain(SECRET);
  });

  it('writes a blank token and prints the portal URL', async () => {
    const run = harness(['--write', '--record', RECORD], { id: RECORD, fields: {} });
    expect(await run.run()).toBe(0);
    expect(run.patches).toEqual([{ id: RECORD, fields: { fldBr9O48s8nRuxrm: GENERATED } }]);
    expect(run.logs.join('\n')).toContain(`${BASE}/p/${GENERATED}`);
    expect(JSON.stringify(run.patches)).not.toContain('Portal link');
    expect(run.logs.join('\n')).not.toContain(SECRET);
    expect(run.didList()).toBe(false);
  });

  it('does not overwrite a token that is already set, and still prints its URL', async () => {
    const run = harness(['--write', '--record', RECORD], {
      id: RECORD,
      fields: { 'Portal token': EXISTING, 'Important notes': 'keep', 'Portal link': 'https://evil.example/p/nope' },
    });
    expect(await run.run()).toBe(0);
    expect(run.patches).toEqual([]);
    const text = run.logs.join('\n');
    expect(text).toContain('left unchanged');
    expect(text).toContain(`${BASE}/p/${EXISTING}`);
    expect(text).not.toContain('evil.example');
    expect(text).not.toContain('Important notes');
    expect(text).not.toContain(SECRET);
  });

  it('does not list bookings when the record is missing', async () => {
    const run = harness(['--record', RECORD], null);
    expect(await run.run()).toBe(1);
    expect(run.errors.join('\n')).toContain(RECORD);
    expect(run.patches).toEqual([]);
    expect(run.didList()).toBe(false);
  });

  it('redacts the Airtable token if a write error includes it', async () => {
    const logs: string[] = [];
    const errors: string[] = [];
    const code = await executePortalTokens({
      argv: ['--write', '--record', RECORD],
      publicBaseUrl: BASE,
      tokenFieldName: 'Portal token',
      fieldKey: 'Portal token',
      airtableTokenSet: true,
      secret: SECRET,
      listMissing: async () => {
        throw new Error('should not list');
      },
      getRecord: async () => ({ id: RECORD, fields: {} }),
      writeTokens: async () => {
        throw new Error(`Airtable said ${SECRET} in the body`);
      },
      log: (line) => logs.push(line),
      error: (line) => errors.push(line),
      generateToken: () => GENERATED,
    });
    expect(code).toBe(1);
    expect(errors.join('\n')).toContain('[redacted]');
    expect(errors.join('\n')).not.toContain(SECRET);
    expect(logs.join('\n')).not.toContain(SECRET);
  });

  it('says when the public URL cannot be built', () => {
    expect(portalUrlForToken(null, EXISTING)).toBeNull();
    expect(portalUrlForToken(BASE, 'short')).toBeNull();
    expect(planRecordToken({ id: RECORD, fields: { 'Portal token': EXISTING } }, 'Portal token', true, () => {
      throw new Error('must not generate');
    })).toEqual({ action: 'keep', token: EXISTING });
  });
});

describe('redactSecret', () => {
  it('removes the Airtable token and leaves other text', () => {
    expect(redactSecret(`failed ${SECRET} twice ${SECRET}`, SECRET)).toBe('failed [redacted] twice [redacted]');
    expect(redactSecret('AIRTABLE_TOKEN is not set. Refusing to continue.', null)).toBe(
      'AIRTABLE_TOKEN is not set. Refusing to continue.',
    );
  });
});
