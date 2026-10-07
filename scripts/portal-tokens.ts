import { createAirtableClient } from '../src/lib/airtableClient';
import { executePortalTokens, redactSecret } from '../src/lib/portalTokenCommand';
import { PortalConfigError, portalTokenWriteKey, readPortalConfig } from '../src/lib/portalConfig';
import { generatePortalToken } from '../src/lib/portalTokenGenerate';

/**
 * Fill blank Portal token values. Dry run unless --write is passed.
 * --record limits the run to one booking. Never writes Portal link, and never replaces a token.
 */
async function main(): Promise<void> {
  let config;
  try {
    config = readPortalConfig(process.env);
  } catch (err) {
    const message = err instanceof PortalConfigError ? err.message : 'Could not read portal config';
    console.error(redactSecret(message, process.env.AIRTABLE_TOKEN));
    process.exitCode = 1;
    return;
  }

  const client = config.airtableToken ? createAirtableClient(config) : null;
  const code = await executePortalTokens({
    argv: process.argv.slice(2),
    publicBaseUrl: config.publicBaseUrl,
    tokenFieldName: config.tokenFieldName,
    fieldKey: portalTokenWriteKey(config),
    airtableTokenSet: !!config.airtableToken,
    secret: config.airtableToken,
    listMissing: () => {
      if (!client) throw new Error('AIRTABLE_TOKEN is not set');
      return client.listBookingsForTokenFill();
    },
    getRecord: (id) => {
      if (!client) throw new Error('AIRTABLE_TOKEN is not set');
      return client.getBookingForTokenFill(id);
    },
    writeTokens: (patches) => {
      if (!client) throw new Error('AIRTABLE_TOKEN is not set');
      return client.writePortalTokens(patches);
    },
    log: (line) => console.log(line),
    error: (line) => console.error(line),
    generateToken: generatePortalToken,
  });
  if (code !== 0) process.exitCode = code;
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : 'Portal token script failed';
  console.error(redactSecret(message, process.env.AIRTABLE_TOKEN));
  process.exitCode = 1;
});
