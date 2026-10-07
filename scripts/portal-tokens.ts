import { createAirtableClient } from '../src/lib/airtableClient';
import { PortalConfigError, portalTokenWriteKey, readPortalConfig } from '../src/lib/portalConfig';
import { runPortalTokens } from '../src/lib/tokenBatch';

/**
 * Fill blank Portal token values. Dry run unless --write is passed.
 * Never writes Portal link, and never replaces a token that is already set.
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('Usage: npm run portal:tokens [-- --write]');
    console.log('Dry run by default. --write stores a new token on bookings that do not have one.');
    return;
  }
  const unknown = args.filter((arg) => arg !== '--write');
  if (unknown.length) {
    console.error('Unknown argument. Use --write to save tokens, or no arguments for a dry run.');
    process.exitCode = 1;
    return;
  }

  let config;
  try {
    config = readPortalConfig(process.env);
  } catch (err) {
    console.error(err instanceof PortalConfigError ? err.message : 'Could not read portal config');
    process.exitCode = 1;
    return;
  }
  if (!config.airtableToken) {
    console.error('AIRTABLE_TOKEN is not set. Refusing to continue.');
    process.exitCode = 1;
    return;
  }

  const client = createAirtableClient(config);
  const records = await client.listBookingsForTokenFill();
  await runPortalTokens({
    write: args.includes('--write'),
    records,
    fieldName: config.tokenFieldName,
    fieldKey: portalTokenWriteKey(config),
    log: (line) => console.log(line),
    writeTokens: (patches) => client.writePortalTokens(patches),
  });
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : 'Portal token script failed';
  console.error(message);
  process.exitCode = 1;
});
