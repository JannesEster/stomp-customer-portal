import path from 'node:path';
import { createAirtableClient } from '../src/lib/airtableClient';
import { readPortalConfig } from '../src/lib/portalConfig';
import { createApp } from './app';

const config = readPortalConfig(process.env);
const client = config.airtableToken ? createAirtableClient(config) : null;
const app = createApp({
  config,
  gateway: client,
  writer: client,
  staticDir: path.resolve('dist'),
});

app.listen(config.port, '0.0.0.0', () => {
  console.log(`Stomp customer portal listening on 0.0.0.0:${config.port}`);
  console.log(client ? 'Airtable portal lookup is on.' : 'AIRTABLE_TOKEN is not set. Portal lookup is off.');
});
