/** Decoded preview images stay well under Airtable's 5 MB attachment cap. */
export const MAX_PREVIEW_BYTES = Math.floor(1.5 * 1024 * 1024);

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export type PngDecodeResult =
  | { ok: true; base64: string; width: number; height: number }
  | { ok: false; error: 'invalid_preview' | 'payload_too_large' };

/**
 * Accept a PNG data URL or raw base64. Anything that is not a PNG, or whose
 * dimensions are missing or absurd, is rejected. Over the size cap is a 413.
 */
export function decodePreviewPng(input: unknown): PngDecodeResult {
  if (typeof input !== 'string') return { ok: false, error: 'invalid_preview' };
  const trimmed = input.trim();
  const dataUrl = /^data:image\/png;base64,([\sA-Za-z0-9+/=]+)$/i.exec(trimmed);
  let base64 = dataUrl ? dataUrl[1] : trimmed;
  if (!dataUrl && trimmed.toLowerCase().startsWith('data:')) return { ok: false, error: 'invalid_preview' };
  base64 = base64.replace(/\s/g, '');
  if (!base64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length % 4 !== 0) {
    return { ok: false, error: 'invalid_preview' };
  }
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length > MAX_PREVIEW_BYTES) return { ok: false, error: 'payload_too_large' };
  const size = inspectPng(bytes);
  if (!size) return { ok: false, error: 'invalid_preview' };
  return { ok: true, base64, width: size.width, height: size.height };
}

/** PNG signature plus a plausible IHDR. Returns null when the bytes are not a PNG. */
export function inspectPng(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length < 24) return null;
  if (!bytes.subarray(0, 8).equals(PNG_MAGIC)) return null;
  if (bytes.readUInt32BE(8) !== 13) return null;
  if (bytes.toString('ascii', 12, 16) !== 'IHDR') return null;
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width < 1 || height < 1 || width > 8192 || height > 8192) return null;
  return { width, height };
}
