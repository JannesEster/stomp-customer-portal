import { createRequire } from 'node:module';
import sharp from 'sharp';
import { preparePortalBytes, type PrepareDeps } from '../src/lib/preparePortalBytes';

const require = createRequire(import.meta.url);

type HeicConvert = (opts: { buffer: Buffer; format: 'JPEG'; quality: number }) => Promise<ArrayBuffer>;

function loadHeicConvert(): HeicConvert {
  return require('heic-convert') as HeicConvert;
}

export const portalPrepareDeps: PrepareDeps = {
  async convertHeic(bytes) {
    const output = await loadHeicConvert()({ buffer: bytes, format: 'JPEG', quality: 0.9 });
    return Buffer.from(output);
  },
  async transcodeJpeg(bytes, opts) {
    return sharp(bytes, { failOn: 'none', animated: false })
      .rotate()
      .flatten({ background: '#ffffff' })
      .resize({ width: opts.maxEdge, height: opts.maxEdge, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: opts.quality, mozjpeg: true })
      .toBuffer();
  },
};

export function prepareCustomerUpload(input: { bytes: Buffer; filename: string; contentType: string }) {
  return preparePortalBytes(input, portalPrepareDeps);
}
