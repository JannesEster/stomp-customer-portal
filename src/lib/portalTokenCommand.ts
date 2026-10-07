import { buildPortalUrl, isValidPortalToken } from './portalToken';
import type { TokenPatch, TokenRecord } from './tokenBatch';
import { runPortalTokens } from './tokenBatch';

const RECORD_ID = /^rec[A-Za-z0-9]{14}$/;

export function isAirtableRecordId(value: string): boolean {
  return RECORD_ID.test(value);
}

export type PortalTokenArgs =
  | { ok: true; help: boolean; write: boolean; recordId: string | null }
  | { ok: false; error: string };

/** Parse CLI args. A bad record id is rejected without echoing the value. */
export function parsePortalTokenArgs(argv: string[]): PortalTokenArgs {
  let help = false;
  let write = false;
  let recordId: string | null = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help') {
      help = true;
      continue;
    }
    if (arg === '--write') {
      write = true;
      continue;
    }
    if (arg === '--record') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) {
        return { ok: false, error: '--record needs one booking id.' };
      }
      i += 1;
      if (!isAirtableRecordId(value)) {
        return { ok: false, error: '--record must be an Airtable record id, rec and 14 letters or numbers.' };
      }
      if (recordId) return { ok: false, error: '--record can only be passed once.' };
      recordId = value;
      continue;
    }
    return {
      ok: false,
      error: 'Unknown argument. Use --write to save tokens, --record <recId> for one booking, or no arguments for a dry run.',
    };
  }

  return { ok: true, help, write, recordId };
}

export function portalTokenUsage(): string {
  return [
    'Usage: npm run portal:tokens [-- --write] [-- --record <recId>]',
    'Dry run by default. --write stores a new token on bookings that do not have one.',
    '--record targets one booking. A token that is already set is left unchanged.',
  ].join('\n');
}

/** Drop a secret from a message. The portal script must not print AIRTABLE_TOKEN. */
export function redactSecret(message: string, secret: string | null | undefined): string {
  if (!secret) return message;
  return message.split(secret).join('[redacted]');
}

export function portalTokenOnRecord(record: TokenRecord, fieldName: string): string | null {
  const value = record.fields?.[fieldName];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * One booking. Dry run writes nothing. --write fills a blank Portal token and never replaces one.
 * The returned token is only for building a portal URL. Callers must not log it on its own.
 */
export function planRecordToken(
  record: TokenRecord,
  fieldName: string,
  write: boolean,
  generateToken: () => string,
): { action: 'keep'; token: string } | { action: 'dry-run-blank' } | { action: 'write'; token: string } {
  const existing = portalTokenOnRecord(record, fieldName);
  if (existing) return { action: 'keep', token: existing };
  if (!write) return { action: 'dry-run-blank' };
  return { action: 'write', token: generateToken() };
}

export function portalUrlForToken(publicBaseUrl: string | null, token: string): string | null {
  if (!isValidPortalToken(token)) return null;
  return buildPortalUrl(publicBaseUrl, token);
}

export async function executePortalTokens(opts: {
  argv: string[];
  publicBaseUrl: string | null;
  tokenFieldName: string;
  fieldKey: string;
  airtableTokenSet: boolean;
  listMissing: () => Promise<TokenRecord[]>;
  getRecord: (id: string) => Promise<TokenRecord | null>;
  writeTokens: (patches: TokenPatch[]) => Promise<void>;
  log?: (line: string) => void;
  error?: (line: string) => void;
  generateToken?: () => string;
  secret?: string | null;
}): Promise<number> {
  const log = (line: string) => (opts.log ?? (() => {}))(redactSecret(line, opts.secret));
  const error = (line: string) => (opts.error ?? opts.log ?? (() => {}))(redactSecret(line, opts.secret));
  const parsed = parsePortalTokenArgs(opts.argv);
  if (!parsed.ok) {
    error(parsed.error);
    return 1;
  }
  if (parsed.help) {
    log(portalTokenUsage());
    return 0;
  }
  if (!opts.airtableTokenSet) {
    error('AIRTABLE_TOKEN is not set. Refusing to continue.');
    return 1;
  }

  try {
    if (parsed.recordId) {
      const record = await opts.getRecord(parsed.recordId);
      if (!record || record.id !== parsed.recordId) {
        error(`No booking found for ${parsed.recordId}.`);
        return 1;
      }
      const plan = planRecordToken(record, opts.tokenFieldName, parsed.write, opts.generateToken ?? (() => {
        throw new Error('generateToken is required when writing');
      }));
      if (plan.action === 'write') {
        await opts.writeTokens([{ id: record.id, fields: { [opts.fieldKey]: plan.token } }]);
        log(`Wrote a portal token for ${record.id}.`);
      } else if (plan.action === 'keep') {
        log(`${record.id} already has a portal token. It was left unchanged.`);
      } else {
        log(`Dry run. ${record.id} has no portal token. No records were changed. Run with --write to set one.`);
        return 0;
      }
      const url = portalUrlForToken(opts.publicBaseUrl, plan.token);
      log(url ?? 'PUBLIC_BASE_URL is not set, so the portal URL was not printed.');
      return 0;
    }

    const records = await opts.listMissing();
    await runPortalTokens({
      write: parsed.write,
      records,
      fieldName: opts.tokenFieldName,
      fieldKey: opts.fieldKey,
      writeTokens: opts.writeTokens,
      log,
      generateToken: opts.generateToken,
    });
    return 0;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Portal token script failed';
    error(redactSecret(message, opts.secret));
    return 1;
  }
}
