import {
  AIRTABLE_UPLOAD_MAX_BYTES,
  HEIC_FAILED_MESSAGE,
  TOO_LARGE_MESSAGE,
  fileMime,
  jpegFilename,
  safeOriginalName,
} from './portalFiles';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']);
const PASS_THROUGH = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'application/pdf',
]);

export interface PrepareDeps {
  convertHeic: (bytes: Buffer) => Promise<Buffer>;
  transcodeJpeg: (bytes: Buffer, opts: { maxEdge: number; quality: number }) => Promise<Buffer>;
}

export type PreparedUpload =
  | { ok: true; bytes: Buffer; contentType: string; filename: string }
  | { ok: false; error: 'too_large' | 'unsupported'; message: string };

const EDGES = [2560, 2048, 1600, 1280, 960, 720];
const QUALITIES = [82, 72, 60, 48, 38];

/**
 * HEIC and HEIF become JPEG. Photos over 5 MB are reduced until they fit.
 * Videos and PDFs that are still over 5 MB are refused with a message, not discarded quietly.
 */
export async function preparePortalBytes(
  input: { bytes: Buffer; filename: string; contentType: string },
  deps: PrepareDeps,
): Promise<PreparedUpload> {
  const filename = safeOriginalName(input.filename);
  const type = fileMime({ name: filename, type: input.contentType });
  if (!input.bytes.length) {
    return { ok: false, error: 'unsupported', message: 'That file was empty. Please choose it again.' };
  }
  if (type === 'image/heic' || type === 'image/heif') {
    let jpeg: Buffer;
    try {
      jpeg = await deps.convertHeic(input.bytes);
    } catch {
      return { ok: false, error: 'unsupported', message: HEIC_FAILED_MESSAGE };
    }
    if (!jpeg.length) return { ok: false, error: 'unsupported', message: HEIC_FAILED_MESSAGE };
    if (jpeg.length <= AIRTABLE_UPLOAD_MAX_BYTES) {
      return { ok: true, bytes: jpeg, contentType: 'image/jpeg', filename: jpegFilename(filename) };
    }
    return fitJpeg(jpeg, filename, deps);
  }
  if (!PASS_THROUGH.has(type) && !IMAGE_TYPES.has(type)) {
    return { ok: false, error: 'unsupported', message: `${filename} isn't a supported file type.` };
  }
  if (input.bytes.length <= AIRTABLE_UPLOAD_MAX_BYTES) {
    return { ok: true, bytes: input.bytes, contentType: type, filename };
  }
  if (type.startsWith('video/') || type === 'application/pdf') {
    return { ok: false, error: 'too_large', message: TOO_LARGE_MESSAGE };
  }
  return fitJpeg(input.bytes, filename, deps);
}

async function fitJpeg(bytes: Buffer, filename: string, deps: PrepareDeps): Promise<PreparedUpload> {
  let sawImage = false;
  for (const maxEdge of EDGES) {
    for (const quality of QUALITIES) {
      let jpeg: Buffer;
      try {
        jpeg = await deps.transcodeJpeg(bytes, { maxEdge, quality });
      } catch {
        if (!sawImage) {
          return {
            ok: false,
            error: 'unsupported',
            message: `We couldn't read ${filename}. Please try a different photo.`,
          };
        }
        continue;
      }
      sawImage = true;
      if (jpeg.length > 0 && jpeg.length <= AIRTABLE_UPLOAD_MAX_BYTES) {
        return { ok: true, bytes: jpeg, contentType: 'image/jpeg', filename: jpegFilename(filename) };
      }
    }
  }
  return { ok: false, error: 'too_large', message: TOO_LARGE_MESSAGE };
}
