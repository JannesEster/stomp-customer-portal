import { randomFillSync } from 'node:crypto';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { AIRTABLE_UPLOAD_MAX_BYTES } from '../src/lib/portalFiles';
import { prepareCustomerUpload } from './prepareUpload';

describe('prepareCustomerUpload', () => {
  it('keeps a small PNG as a PNG', async () => {
    const png = await sharp({
      create: { width: 24, height: 16, channels: 3, background: '#224466' },
    })
      .png()
      .toBuffer();
    const prepared = await prepareCustomerUpload({ bytes: png, filename: 'tiny.png', contentType: 'image/png' });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.contentType).toBe('image/png');
    expect(prepared.bytes.length).toBeLessThanOrEqual(AIRTABLE_UPLOAD_MAX_BYTES);
  });

  it('turns a large photo into a JPEG under 5 MB', async () => {
    const raw = Buffer.alloc(2800 * 2800 * 3);
    randomFillSync(raw);
    const photo = await sharp(raw, { raw: { width: 2800, height: 2800, channels: 3 } })
      .jpeg({ quality: 90 })
      .toBuffer();
    expect(photo.length).toBeGreaterThan(AIRTABLE_UPLOAD_MAX_BYTES);
    const prepared = await prepareCustomerUpload({ bytes: photo, filename: 'crowd.jpg', contentType: 'image/jpeg' });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.contentType).toBe('image/jpeg');
    expect(prepared.filename).toBe('crowd.jpg');
    expect(prepared.bytes.length).toBeLessThanOrEqual(AIRTABLE_UPLOAD_MAX_BYTES);
    expect(prepared.bytes.length).toBeGreaterThan(1000);
  });
});
