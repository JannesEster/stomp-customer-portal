import { generatePortalToken } from './portalTokenGenerate';

export interface TokenRecord {
  id: string;
  fields?: Record<string, unknown>;
}

/** Records with no usable portal token. A value that is already set is left alone. */
export function bookingsMissingTokens(records: TokenRecord[], fieldName: string): { id: string }[] {
  return records
    .filter((record) => {
      const value = record.fields?.[fieldName];
      return typeof value !== 'string' || value.trim() === '';
    })
    .map((record) => ({ id: record.id }));
}

export interface TokenPatch {
  id: string;
  fields: Record<string, string>;
}

/**
 * Dry run lists ids and writes nothing.
 * `--write` sets only the portal token field. Portal link is never included.
 */
export async function runPortalTokens(opts: {
  write: boolean;
  records: TokenRecord[];
  fieldName: string;
  fieldKey: string;
  writeTokens?: (patches: TokenPatch[]) => Promise<void>;
  log?: (line: string) => void;
  generateToken?: () => string;
}): Promise<{ written: number }> {
  const log = opts.log ?? (() => {});
  const missing = bookingsMissingTokens(opts.records, opts.fieldName);

  if (!opts.write) {
    log(`Dry run. Bookings missing a portal token: ${missing.length}.`);
    for (const row of missing) log(row.id);
    log('No records were changed. Run with --write to set tokens.');
    return { written: 0 };
  }

  const generate = opts.generateToken ?? generatePortalToken;
  const patches: TokenPatch[] = missing.map((row) => ({
    id: row.id,
    fields: { [opts.fieldKey]: generate() },
  }));
  if (patches.length) {
    if (!opts.writeTokens) throw new Error('writeTokens is required when writing');
    await opts.writeTokens(patches);
  }
  log(`Wrote portal tokens for ${patches.length} bookings.`);
  return { written: patches.length };
}

export function chunkItems<T>(items: T[], size: number): T[][] {
  if (size < 1) throw new Error('chunk size must be at least 1');
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}
