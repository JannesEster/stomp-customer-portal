import Busboy from 'busboy';
import type { Request } from 'express';
import { TOO_LARGE_MESSAGE } from '../src/lib/portalFiles';

/** A little over the 20 MB photo limit, so a photo can be reduced under Airtable's 5 MB cap. */
export const MAX_UPLOAD_BYTES = 22 * 1024 * 1024;

export type UploadBody =
  | { ok: true; role: string; file: { bytes: Buffer; filename: string; contentType: string } }
  | { ok: false; error: 'invalid_upload' | 'too_large'; message: string };

export function readUpload(req: Request): Promise<UploadBody> {
  const type = req.headers['content-type'] ?? '';
  if (!type.includes('multipart/form-data')) {
    return Promise.resolve({
      ok: false,
      error: 'invalid_upload',
      message: 'Choose a file and try again.',
    });
  }

  return new Promise((resolve) => {
    const parser = Busboy({
      headers: req.headers,
      limits: { files: 1, fileSize: MAX_UPLOAD_BYTES, fields: 4, fieldSize: 200, parts: 6 },
    });
    let role = '';
    const chunks: Buffer[] = [];
    let filename = 'file';
    let contentType = 'application/octet-stream';
    let sawFile = false;
    let truncated = false;
    let settled = false;

    const finish = (result: UploadBody) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    parser.on('field', (name, value) => {
      if (name === 'role') role = value;
    });
    parser.on('file', (name, stream, info) => {
      if (name !== 'file' || sawFile) {
        stream.resume();
        return;
      }
      sawFile = true;
      filename = info.filename || 'file';
      contentType = info.mimeType || 'application/octet-stream';
      stream.on('data', (chunk: Buffer) => {
        if (!truncated) chunks.push(chunk);
      });
      stream.on('limit', () => {
        truncated = true;
        chunks.length = 0;
        stream.resume();
      });
    });
    parser.on('error', () => {
      finish({ ok: false, error: 'invalid_upload', message: 'Choose a file and try again.' });
    });
    parser.on('finish', () => {
      if (truncated) {
        finish({ ok: false, error: 'too_large', message: TOO_LARGE_MESSAGE });
        return;
      }
      if (!sawFile) {
        finish({ ok: false, error: 'invalid_upload', message: 'Choose a file and try again.' });
        return;
      }
      finish({
        ok: true,
        role,
        file: { bytes: Buffer.concat(chunks), filename, contentType },
      });
    });
    req.pipe(parser);
  });
}
