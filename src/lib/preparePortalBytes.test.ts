import { describe, expect, it } from 'vitest';
import { AIRTABLE_UPLOAD_MAX_BYTES, HEIC_FAILED_MESSAGE, TOO_LARGE_MESSAGE } from './portalFiles';
import { preparePortalBytes, type PrepareDeps } from './preparePortalBytes';

function deps(overrides: Partial<PrepareDeps> = {}): PrepareDeps {
  return {
    convertHeic: async () => Buffer.from('jpeg-bytes'),
    transcodeJpeg: async (bytes) => bytes.subarray(0, 100),
    ...overrides,
  };
}

describe('preparePortalBytes', () => {
  it('converts HEIC to JPEG and renames the file', async () => {
    const prepared = await preparePortalBytes(
      { bytes: Buffer.from('heic-data'), filename: 'rings.HEIC', contentType: '' },
      deps(),
    );
    expect(prepared).toMatchObject({ ok: true, contentType: 'image/jpeg', filename: 'rings.jpg' });
    if (!prepared.ok) return;
    expect(prepared.bytes.toString()).toBe('jpeg-bytes');
  });

  it('says so when a HEIC photo cannot be read', async () => {
    const prepared = await preparePortalBytes(
      { bytes: Buffer.from('nope'), filename: 'rings.heic', contentType: 'image/heic' },
      deps({
        convertHeic: async () => {
          throw new Error('bad heic');
        },
      }),
    );
    expect(prepared).toEqual({ ok: false, error: 'unsupported', message: HEIC_FAILED_MESSAGE });
  });

  it('reduces a large photo until it fits', async () => {
    const calls: number[] = [];
    const prepared = await preparePortalBytes(
      { bytes: Buffer.alloc(AIRTABLE_UPLOAD_MAX_BYTES + 50, 1), filename: 'big.png', contentType: 'image/png' },
      deps({
        transcodeJpeg: async (_bytes, opts) => {
          calls.push(opts.quality);
          return opts.quality <= 72 ? Buffer.alloc(1000, 2) : Buffer.alloc(AIRTABLE_UPLOAD_MAX_BYTES + 10, 3);
        },
      }),
    );
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.contentType).toBe('image/jpeg');
    expect(prepared.filename).toBe('big.jpg');
    expect(prepared.bytes.length).toBeLessThanOrEqual(AIRTABLE_UPLOAD_MAX_BYTES);
    expect(calls.length).toBeGreaterThan(1);
  });

  it('refuses a video that is still over 5 MB and keeps a clear message', async () => {
    const prepared = await preparePortalBytes(
      { bytes: Buffer.alloc(AIRTABLE_UPLOAD_MAX_BYTES + 1, 1), filename: 'dance.mp4', contentType: 'video/mp4' },
      deps(),
    );
    expect(prepared).toEqual({ ok: false, error: 'too_large', message: TOO_LARGE_MESSAGE });
  });

  it('passes a small video through unchanged', async () => {
    const bytes = Buffer.from('small-video');
    const prepared = await preparePortalBytes(
      { bytes, filename: 'dance.mp4', contentType: 'video/mp4' },
      deps(),
    );
    expect(prepared).toMatchObject({ ok: true, contentType: 'video/mp4', filename: 'dance.mp4' });
  });
});
