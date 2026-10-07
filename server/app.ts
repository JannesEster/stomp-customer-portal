import path from 'node:path';
import express, { type Express, type Request } from 'express';
import extrasJson from '../src/config/extras.json';
import { portalLookupFailureLine } from '../src/lib/airtableClient';
import type { PortalEnvConfig } from '../src/lib/portalConfig';
import { lookupBookingByToken, type AirtableGateway } from '../src/lib/portalLookup';
import { isValidPortalToken } from '../src/lib/portalToken';
import { createRateLimiter } from '../src/lib/rateLimit';

const extras = extrasJson.extras.map((extra) => ({ id: extra.id, name: extra.name }));

export function createApp(opts: {
  config: PortalEnvConfig;
  gateway: AirtableGateway | null;
  staticDir: string;
  rateLimit?: { windowMs: number; max: number };
}): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  const limit = createRateLimiter(opts.rateLimit ?? { windowMs: 60_000, max: 30 });

  app.get('/healthz', (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.get('/api/portal/:token', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!limit(clientKey(req))) {
      res.set('Retry-After', '60');
      res.status(429).json({ error: 'rate_limited' });
      return;
    }

    const token = req.params.token;
    if (!isValidPortalToken(token)) {
      res.status(400).json({ error: 'invalid_token' });
      return;
    }
    if (!opts.gateway) {
      res.status(503).json({ error: 'portal_unavailable' });
      return;
    }

    try {
      const result = await lookupBookingByToken(token, {
        gateway: opts.gateway,
        tokenFieldName: opts.config.tokenFieldName,
        fields: opts.config.fields,
        extras,
        publicBaseUrl: opts.config.publicBaseUrl,
      });
      if (!result.ok) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      res.json({
        customer: result.portal.customer,
        booking: result.portal.booking,
        portalUrl: result.portalUrl,
      });
    } catch (err) {
      console.error(portalLookupFailureLine(err));
      res.status(502).json({ error: 'upstream_failed' });
    }
  });

  // No list route. Anything else under /api is a 404.
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'not_found' });
  });

  app.use(express.static(opts.staticDir, { index: false, fallthrough: true }));

  app.use((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.status(404).end();
      return;
    }
    if (path.extname(req.path)) {
      res.status(404).end();
      return;
    }
    res.sendFile(path.join(opts.staticDir, 'index.html'), (err) => {
      if (err) res.status(404).end();
    });
  });

  return app;
}

function clientKey(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}
