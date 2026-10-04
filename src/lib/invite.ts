import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { floorNamesColour, paletteFromPixels, type Palette } from './palette';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const PREVIEW_MAX_PX = 900;
const SAMPLE_MAX_PX = 320;

export interface InviteAnalysis {
  palette: Palette | null;
  namesColour: string | null;
  /** A PNG of the first page, only for PDFs, so phones can show a thumbnail */
  preview: Blob | null;
}

/** Reads an uploaded invite (PDF or image) and pulls out its colours. Runs entirely in the browser. */
export async function analyseInvite(file: File): Promise<InviteAnalysis> {
  const isPdf = file.type === 'application/pdf';
  const page = isPdf ? await renderPdfFirstPage(file) : await loadImageCanvas(file);
  const preview = isPdf ? await new Promise<Blob | null>((res) => page.toBlob(res, 'image/png')) : null;
  const palette = paletteFromPixels(samplePixels(page));
  return { palette, namesColour: palette ? floorNamesColour(palette) : null, preview };
}

async function renderPdfFirstPage(file: File): Promise<HTMLCanvasElement> {
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  try {
    const pdf = await task.promise;
    const page = await pdf.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: PREVIEW_MAX_PX / Math.max(base.width, base.height) });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    await page.render({ canvas, viewport }).promise;
    return canvas;
  } finally {
    void task.destroy();
  }
}

async function loadImageCanvas(file: File): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, PREVIEW_MAX_PX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

function samplePixels(source: HTMLCanvasElement): Uint8ClampedArray {
  const scale = Math.min(1, SAMPLE_MAX_PX / Math.max(source.width, source.height));
  const w = Math.max(1, Math.round(source.width * scale));
  const h = Math.max(1, Math.round(source.height * scale));
  const small = document.createElement('canvas');
  small.width = w;
  small.height = h;
  const ctx = small.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h).data;
}
