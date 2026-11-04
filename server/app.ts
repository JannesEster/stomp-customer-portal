import path from 'node:path';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import extrasJson from '../src/config/extras.json';
import {
  AirtableRequestError,
  isAirtableFileUrl,
  portalLookupFailureLine,
  portalWriteFailureLine,
  type PortalAttachment,
  type PortalWriter,
} from '../src/lib/airtableClient';
import {
  PORTAL_ANSWERS_FIELD,
  PORTAL_FIRST_OPENED_FIELD,
  PORTAL_FLOOR_DESIGN_FIELD,
  PORTAL_FLOOR_PREVIEW_FIELD,
  PORTAL_LAST_SAVED_FIELD,
  PORTAL_PROGRESS_FIELD,
  PORTAL_STEPS_MISSING_FIELD,
  PORTAL_SUMMARY_FIELD,
  PORTAL_SUPPLIERS_FIELD,
} from '../src/lib/airtableFields';
import { sanitizePortalAnswers } from '../src/lib/portalAnswers';
import type { PortalEnvConfig } from '../src/lib/portalConfig';
import { lookupBookingByToken, type AirtableGateway, type PortalLookupResult } from '../src/lib/portalLookup';
import {
  REMOVE_FAILED_MESSAGE,
  UPLOAD_FAILED_MESSAGE,
  attachmentFilename,
  isUploadRole,
  portalUploadsList,
  preserveStoredFiles,
  UPLOAD_LABELS,
  type UploadRole,
} from '../src/lib/portalFiles';
import { floorDesignLabel, portalStepReport, portalSummary, supplierLines } from '../src/lib/portalProgress';
import { isValidPortalToken } from '../src/lib/portalToken';
import { decodePreviewPng } from '../src/lib/pngImage';
import { createRateLimiter } from '../src/lib/rateLimit';
import type { DesignState } from '../src/types';
import { prepareCustomerUpload } from './prepareUpload';
import { readUpload } from './readUpload';

const extras = extrasJson.extras.map((extra) => ({ id: extra.id, name: extra.name }));

export function createApp(opts: {
  config: PortalEnvConfig;
  gateway: AirtableGateway | null;
  writer?: PortalWriter | null;
  staticDir: string;
  rateLimit?: { windowMs: number; max: number };
  writeRateLimit?: { windowMs: number; max: number };
  previewRateLimit?: { windowMs: number; max: number };
  uploadRateLimit?: { windowMs: number; max: number };
  fileRateLimit?: { windowMs: number; max: number };
  /** Fetches a fresh Airtable file URL for the customer thumbnail proxy. */
  fileFetch?: typeof fetch;
}): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  const limit = createRateLimiter(opts.rateLimit ?? { windowMs: 60_000, max: 30 });
  const writeLimit = createRateLimiter(opts.writeRateLimit ?? { windowMs: 60_000, max: 20 });
  const previewLimit = createRateLimiter(opts.previewRateLimit ?? { windowMs: 10 * 60_000, max: 6 });
  const uploadLimit = createRateLimiter(opts.uploadRateLimit ?? { windowMs: 10 * 60_000, max: 60 });
  const fileLimit = createRateLimiter(opts.fileRateLimit ?? { windowMs: 60_000, max: 180 });
  const writer = opts.writer ?? null;
  const fileFetch = opts.fileFetch ?? fetch;
  const freshFor = new Map<string, { at: number; result: PortalLookupResult }>();
  const filesFor = new Map<string, { at: number; items: PortalAttachment[] }>();
  const FRESH_MS = 30_000;

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
        savedAnswers: result.saved.savedAnswers,
        lastSavedAt: result.saved.lastSavedAt,
      });
    } catch (err) {
      console.error(portalLookupFailureLine(err));
      res.status(502).json({ error: 'upstream_failed' });
    }
  });

  const answerPaths = ['/api/portal/:token/answers', '/api/p/:token/answers'];
  app.post(answerPaths, jsonLimit('64kb', 'invalid_answers'), (req, res) => {
    void saveAnswers(req, res);
  });

  const openedPaths = ['/api/portal/:token/opened', '/api/p/:token/opened'];
  app.post(openedPaths, (req, res) => {
    void markOpened(req, res);
  });

  const previewPaths = ['/api/portal/:token/preview', '/api/p/:token/preview'];
  app.post(previewPaths, jsonLimit('8mb', 'invalid_preview'), (req, res) => {
    void savePreview(req, res);
  });

  const uploadPaths = ['/api/portal/:token/uploads', '/api/p/:token/uploads'];
  app.post(uploadPaths, (req, res) => {
    void receiveUpload(req, res);
  });

  const removePaths = ['/api/portal/:token/uploads/remove', '/api/p/:token/uploads/remove'];
  app.post(removePaths, jsonLimit('16kb', 'invalid_upload'), (req, res) => {
    void removeUpload(req, res);
  });

  const filePaths = ['/api/portal/:token/files/:attachmentId', '/api/p/:token/files/:attachmentId'];
  app.get(filePaths, (req, res) => {
    void sendStoredFile(req, res);
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

  function allowWrite(req: Request, token: string): boolean {
    return writeLimit(`ip:${clientKey(req)}`) && writeLimit(`token:${token}`);
  }

  /** Token shape, Airtable availability, then the write limiter. Returns the token or null after responding. */
  function acceptWrite(req: Request, res: Response): string | null {
    const token = req.params.token;
    if (typeof token !== 'string' || !isValidPortalToken(token)) {
      res.status(400).json({ error: 'invalid_token' });
      return null;
    }
    if (!opts.gateway || !writer) {
      res.status(503).json({ error: 'portal_unavailable' });
      return null;
    }
    if (!allowWrite(req, token)) {
      res.set('Retry-After', '60');
      res.status(429).json({ error: 'rate_limited' });
      return null;
    }
    return token;
  }

  function loadBooking(token: string): Promise<PortalLookupResult> {
    return lookupBookingByToken(token, {
      gateway: opts.gateway as AirtableGateway,
      tokenFieldName: opts.config.tokenFieldName,
      fields: opts.config.fields,
      extras,
      publicBaseUrl: opts.config.publicBaseUrl,
    });
  }

  async function saveAnswers(req: Request, res: Response): Promise<void> {
    res.set('Cache-Control', 'no-store');
    const token = acceptWrite(req, res);
    if (!token || !writer) return;
    let result: PortalLookupResult;
    try {
      result = await loadBooking(token);
    } catch (err) {
      console.error(portalLookupFailureLine(err));
      res.status(502).json({ error: 'upstream_failed' });
      return;
    }
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    const sanitized = sanitizePortalAnswers(answersFromBody(req.body), result.portal.booking.coupleNames);
    if (!sanitized.ok) {
      res.status(400).json({ error: 'invalid_answers' });
      return;
    }

    const design = preserveStoredFiles(sanitized.design, storedDesign(result.saved.savedAnswers));
    const screens = result.portal.booking.screensBooked;
    const report = portalStepReport(design, screens);
    const savedAt = new Date().toISOString();
    const fields: Record<string, unknown> = {
      [PORTAL_ANSWERS_FIELD]: JSON.stringify(design),
      [PORTAL_SUMMARY_FIELD]: portalSummary(design, screens),
      [PORTAL_PROGRESS_FIELD]: report.progress,
      [PORTAL_STEPS_MISSING_FIELD]: report.missing.join(', '),
      [PORTAL_LAST_SAVED_FIELD]: savedAt,
      [PORTAL_FLOOR_DESIGN_FIELD]: floorDesignLabel(design),
      [PORTAL_SUPPLIERS_FIELD]: supplierLines(design),
      [opts.config.portalUploadsListFieldId]: portalUploadsList(design),
    };
    if (!result.saved.firstOpenedAt) fields[PORTAL_FIRST_OPENED_FIELD] = savedAt;

    try {
      await writer.patchBooking(result.portal.booking.id, fields);
    } catch (err) {
      writeFailed(res, err);
      return;
    }
    res.json({ ok: true, lastSavedAt: savedAt });
  }

  async function markOpened(req: Request, res: Response): Promise<void> {
    res.set('Cache-Control', 'no-store');
    const token = acceptWrite(req, res);
    if (!token || !writer) return;
    let result: PortalLookupResult;
    try {
      result = await loadBooking(token);
    } catch (err) {
      console.error(portalLookupFailureLine(err));
      res.status(502).json({ error: 'upstream_failed' });
      return;
    }
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    if (!result.saved.firstOpenedAt) {
      try {
        await writer.patchBooking(result.portal.booking.id, {
          [PORTAL_FIRST_OPENED_FIELD]: new Date().toISOString(),
        });
      } catch (err) {
        writeFailed(res, err);
        return;
      }
    }
    res.json({ ok: true });
  }

  async function savePreview(req: Request, res: Response): Promise<void> {
    res.set('Cache-Control', 'no-store');
    const token = acceptWrite(req, res);
    if (!token || !writer) return;
    const images = readPreviewImages(req.body);
    if (!images.ok) {
      res.status(images.error === 'payload_too_large' ? 413 : 400).json({ error: images.error });
      return;
    }
    if (!previewLimit(token)) {
      res.set('Retry-After', '600');
      res.status(429).json({ error: 'rate_limited' });
      return;
    }

    let result: PortalLookupResult;
    try {
      result = await loadBooking(token);
    } catch (err) {
      console.error(portalLookupFailureLine(err));
      res.status(502).json({ error: 'upstream_failed' });
      return;
    }
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    try {
      await writer.patchBooking(result.portal.booking.id, { [PORTAL_FLOOR_PREVIEW_FIELD]: [] });
      for (const image of images.list) {
        await writer.uploadFloorPreview(result.portal.booking.id, image);
      }
    } catch (err) {
      writeFailed(res, err);
      return;
    }
    res.json({ ok: true });
  }

  function allowUpload(req: Request, token: string): boolean {
    return uploadLimit(`ip:${clientKey(req)}`) && uploadLimit(`token:${token}`);
  }

  function acceptToken(req: Request, res: Response, message: string): string | null {
    const token = req.params.token;
    if (typeof token !== 'string' || !isValidPortalToken(token)) {
      res.status(400).json({ error: 'invalid_token', message });
      return null;
    }
    if (!opts.gateway || !writer) {
      res.status(503).json({ error: 'portal_unavailable', message });
      return null;
    }
    return token;
  }

  async function receiveUpload(req: Request, res: Response): Promise<void> {
    res.set('Cache-Control', 'no-store');
    const token = acceptToken(req, res, UPLOAD_FAILED_MESSAGE);
    if (!token || !writer) return;
    if (!allowUpload(req, token)) {
      res.set('Retry-After', '60');
      res.status(429).json({ error: 'rate_limited', message: 'Too many files at once. Wait a minute and try again.' });
      return;
    }
    const body = await readUpload(req);
    if (!body.ok) {
      const status = body.error === 'too_large' ? 413 : 400;
      res.status(status).json({ error: body.error, message: body.message });
      return;
    }
    if (!isUploadRole(body.role)) {
      res.status(400).json({
        error: 'invalid_upload',
        message: "This upload couldn't be matched to a part of your design. Please try again.",
      });
      return;
    }
    const role: UploadRole = body.role;

    let result: PortalLookupResult;
    try {
      result = await loadBooking(token);
    } catch (err) {
      console.error(portalLookupFailureLine(err));
      res.status(502).json({ error: 'upstream_failed', message: UPLOAD_FAILED_MESSAGE });
      return;
    }
    if (!result.ok) {
      res.status(result.status).json({ error: result.error, message: UPLOAD_FAILED_MESSAGE });
      return;
    }

    let prepared: Awaited<ReturnType<typeof prepareCustomerUpload>>;
    try {
      prepared = await prepareCustomerUpload(body.file);
    } catch (err) {
      console.error(portalWriteFailureLine(err));
      res.status(500).json({ error: 'upload_failed', message: UPLOAD_FAILED_MESSAGE });
      return;
    }
    if (!prepared.ok) {
      if (prepared.error === 'too_large') console.error('portal upload rejected reason=too_large');
      const status = prepared.error === 'too_large' ? 413 : 400;
      res.status(status).json({ error: prepared.error, message: prepared.message });
      return;
    }

    try {
      const stored = await writer.uploadPortalFile(result.portal.booking.id, {
        base64: prepared.bytes.toString('base64'),
        filename: attachmentFilename(UPLOAD_LABELS[role], prepared.filename),
        contentType: prepared.contentType,
      });
      filesFor.delete(result.portal.booking.id);
      res.json({
        ok: true,
        attachmentId: stored.id,
        name: prepared.filename,
        type: prepared.contentType,
        size: prepared.bytes.length,
        uploadedAt: new Date().toISOString(),
      });
    } catch (err) {
      writeFailed(res, err, UPLOAD_FAILED_MESSAGE);
    }
  }

  async function removeUpload(req: Request, res: Response): Promise<void> {
    res.set('Cache-Control', 'no-store');
    const token = acceptWrite(req, res);
    if (!token || !writer) return;
    const attachmentId = attachmentIdFrom(req.body);
    if (!attachmentId) {
      res.status(400).json({ error: 'invalid_upload', message: REMOVE_FAILED_MESSAGE });
      return;
    }
    let result: PortalLookupResult;
    try {
      result = await loadBooking(token);
    } catch (err) {
      console.error(portalLookupFailureLine(err));
      res.status(502).json({ error: 'upstream_failed', message: REMOVE_FAILED_MESSAGE });
      return;
    }
    if (!result.ok) {
      res.status(result.status).json({ error: result.error, message: REMOVE_FAILED_MESSAGE });
      return;
    }
    try {
      const existing = await writer.listPortalUploads(result.portal.booking.id);
      if (!existing.some((item) => item.id === attachmentId)) {
        res.json({ ok: true });
        return;
      }
      const remain = existing.filter((item) => item.id !== attachmentId).map((item) => ({ id: item.id }));
      await writer.patchBooking(result.portal.booking.id, {
        [opts.config.portalUploadsFieldId]: remain,
      });
      filesFor.delete(result.portal.booking.id);
      res.json({ ok: true });
    } catch (err) {
      writeFailed(res, err, REMOVE_FAILED_MESSAGE);
    }
  }

  async function loadBookingFresh(token: string): Promise<PortalLookupResult> {
    const hit = freshFor.get(token);
    if (hit && Date.now() - hit.at < FRESH_MS) return hit.result;
    const result = await loadBooking(token);
    if (result.ok) freshFor.set(token, { at: Date.now(), result });
    return result;
  }

  async function sendStoredFile(req: Request, res: Response): Promise<void> {
    res.set('Cache-Control', 'private, max-age=300');
    const attachmentId = req.params.attachmentId;
    if (!ATTACHMENT_ID.test(attachmentId)) {
      res.status(400).json({ error: 'invalid_upload', message: "Couldn't load this file." });
      return;
    }
    if (!fileLimit(`ip:${clientKey(req)}`)) {
      res.set('Retry-After', '60');
      res.status(429).json({ error: 'rate_limited', message: 'Too many files at once. Wait a minute and try again.' });
      return;
    }
    const token = req.params.token;
    if (typeof token !== 'string' || !isValidPortalToken(token)) {
      res.status(400).json({ error: 'invalid_token', message: "Couldn't load this file." });
      return;
    }
    if (!opts.gateway || !writer) {
      res.status(503).json({ error: 'portal_unavailable', message: "Couldn't load this file just now." });
      return;
    }
    let result: PortalLookupResult;
    try {
      result = await loadBookingFresh(token);
    } catch (err) {
      console.error(portalLookupFailureLine(err));
      res.status(502).json({ error: 'upstream_failed', message: "Couldn't load this file just now." });
      return;
    }
    if (!result.ok) {
      res.status(result.status).json({ error: result.error, message: "Couldn't load this file." });
      return;
    }
    let attachments: PortalAttachment[];
    try {
      const cached = filesFor.get(result.portal.booking.id);
      if (cached && Date.now() - cached.at < FRESH_MS) {
        attachments = cached.items;
      } else {
        attachments = await writer.listPortalUploads(result.portal.booking.id);
        filesFor.set(result.portal.booking.id, { at: Date.now(), items: attachments });
      }
    } catch (err) {
      console.error(portalWriteFailureLine(err));
      res.status(502).json({ error: 'upstream_failed', message: "Couldn't load this file just now." });
      return;
    }
    const match = attachments.find((item) => item.id === attachmentId);
    if (!match) {
      res.status(404).json({ error: 'not_found', message: "Couldn't load this file." });
      return;
    }
    const variant = req.query.variant === 'full' ? 'full' : 'thumb';
    const source = variant === 'thumb' && match.thumbUrl ? match.thumbUrl : match.url;
    if (!isAirtableFileUrl(source)) {
      res.status(404).json({ error: 'not_found', message: "Couldn't load this file." });
      return;
    }
    try {
      const upstream = await fileFetch(source, { signal: AbortSignal.timeout(20_000) });
      if (!upstream.ok) {
        res.status(502).json({ error: 'upstream_failed', message: "Couldn't load this file just now." });
        return;
      }
      const bytes = Buffer.from(await upstream.arrayBuffer());
      if (bytes.length === 0 || bytes.length > 8 * 1024 * 1024) {
        res.status(502).json({ error: 'upstream_failed', message: "Couldn't load this file just now." });
        return;
      }
      const contentType = safeContentType(upstream.headers.get('content-type'), match.type);
      res.set('X-Content-Type-Options', 'nosniff');
      res.set('Content-Type', contentType);
      res.set('Content-Disposition', `inline; filename="${safeDownloadName(match.filename)}"`);
      res.status(200).send(bytes);
    } catch (err) {
      console.error(portalWriteFailureLine(err));
      res.status(502).json({ error: 'upstream_failed', message: "Couldn't load this file just now." });
    }
  }

  return app;
}

const ATTACHMENT_ID = /^att[A-Za-z0-9]{14}$/;

function storedDesign(value: unknown): DesignState | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const design = value as DesignState;
  if (design.version !== 3 || !design.designs) return null;
  return design;
}

function attachmentIdFrom(body: unknown): string | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const id = (body as { attachmentId?: unknown }).attachmentId;
  return typeof id === 'string' && ATTACHMENT_ID.test(id) ? id : null;
}

function safeContentType(header: string | null, fallback: string): string {
  const candidate = (header ?? fallback).split(';')[0]?.trim().toLowerCase() ?? '';
  if (/^(image|video)\/[a-z0-9.+-]+$/.test(candidate) || candidate === 'application/pdf') return candidate;
  if (/^(image|video)\/[a-z0-9.+-]+$/.test(fallback) || fallback === 'application/pdf') return fallback;
  return 'application/octet-stream';
}

function safeDownloadName(name: string): string {
  const cleaned = name.replace(/["\r\n]/g, '').slice(0, 180);
  return cleaned || 'file';
}

function writeFailed(res: Response, err: unknown, message?: string): void {
  if (err instanceof AirtableRequestError && (err.status === 401 || err.status === 403)) {
    res.status(502).json({ error: 'write_forbidden', ...(message ? { message } : {}) });
    return;
  }
  console.error(portalWriteFailureLine(err));
  res.status(502).json({ error: 'upstream_failed', ...(message ? { message } : {}) });
}

function answersFromBody(body: unknown): unknown {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
  const record = body as Record<string, unknown>;
  return 'answers' in record ? record.answers : record;
}

function readPreviewImages(
  body: unknown,
): { ok: true; list: { base64: string; filename: string }[] } | { ok: false; error: 'invalid_preview' | 'payload_too_large' } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'invalid_preview' };
  const record = body as Record<string, unknown>;
  const raw = Array.isArray(record.images)
    ? record.images
    : record.png != null
      ? [{ phase: 'holding', png: record.png }]
      : null;
  if (!raw || raw.length === 0 || raw.length > 3) return { ok: false, error: 'invalid_preview' };

  const seen = new Set<string>();
  const list: { base64: string; filename: string }[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return { ok: false, error: 'invalid_preview' };
    const source = item as Record<string, unknown>;
    const phase = source.phase ?? 'holding';
    if (phase !== 'holding' && phase !== 'after' && phase !== 'dancing') return { ok: false, error: 'invalid_preview' };
    if (seen.has(phase)) return { ok: false, error: 'invalid_preview' };
    seen.add(phase);
    const decoded = decodePreviewPng(source.png);
    if (!decoded.ok) return { ok: false, error: decoded.error };
    list.push({ base64: decoded.base64, filename: `floor-${phase}.png` });
  }
  return { ok: true, list };
}

function jsonLimit(limit: string, badJsonError: string) {
  const parser = express.json({ limit });
  return (req: Request, res: Response, next: NextFunction) => {
    parser(req, res, (err: unknown) => {
      if (!err) {
        next();
        return;
      }
      const status = errorStatus(err);
      const type = errorType(err);
      if (status === 413 || type === 'entity.too.large') {
        res.status(413).json({ error: 'payload_too_large' });
        return;
      }
      res.status(400).json({ error: badJsonError });
    });
  };
}

function errorStatus(err: unknown): number {
  if (!err || typeof err !== 'object' || !('status' in err)) return 0;
  const status = (err as { status?: unknown }).status;
  return typeof status === 'number' ? status : 0;
}

function errorType(err: unknown): string {
  if (!err || typeof err !== 'object' || !('type' in err)) return '';
  const type = (err as { type?: unknown }).type;
  return typeof type === 'string' ? type : '';
}

function clientKey(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}
