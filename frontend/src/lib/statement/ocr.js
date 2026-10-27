// Text recognition for PDF statements whose text is drawn as shapes or images (no text layer).
// Runs entirely in this browser: pages are rendered to a canvas and read with Tesseract.
// The recognition engine and English language data are fetched once from a CDN and then cached.

const SCALE = 2.5; // about 180 dpi, enough for statement print

/** Turns Tesseract TSV output into positioned items like PDF text items (y grows upwards). */
export function tsvToItems(tsv, page, scale = SCALE) {
  const items = [];
  String(tsv || '')
    .split('\n')
    .forEach((line) => {
      const f = line.split('\t');
      if (f[0] !== '5' || f.length < 12) return; // level 5 = word
      const [left, top, width, height, conf] = f.slice(6, 11).map(Number);
      const str = f.slice(11).join('\t').trim();
      if (!str || conf < 0) return;
      items.push({ str, x: left / scale, y: -(top + height) / scale, w: width / scale, h: height / scale, page });
    });
  return items;
}

/**
 * Recognises text on every page of an open pdf.js document.
 * onProgress({ page, pages, phase }) is called as work moves on; phase is 'loading' or 'reading'.
 */
export async function recognisePdf(doc, { maxPages = 20, onProgress } = {}) {
  const pages = Math.min(doc.numPages, maxPages);
  onProgress?.({ page: 0, pages, phase: 'loading' });
  const { createWorker, PSM } = await import('tesseract.js');
  const worker = await createWorker('eng', 1);
  try {
    // Sparse text mode keeps each table cell as its own word group, which suits statements.
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, preserve_interword_spaces: '1' });
    const items = [];
    for (let p = 1; p <= pages; p += 1) {
      onProgress?.({ page: p, pages, phase: 'reading' });
      const page = await doc.getPage(p);
      const viewport = page.getViewport({ scale: SCALE });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, canvas, viewport }).promise;
      const { data } = await worker.recognize(canvas, {}, { tsv: true });
      items.push(...tsvToItems(data.tsv, p));
      page.cleanup();
      canvas.width = 0;
      canvas.height = 0;
    }
    return items;
  } finally {
    await worker.terminate();
  }
}
