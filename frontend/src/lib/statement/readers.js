// Reads a statement file in the browser. Nothing is uploaded: only the parsed rows leave this module.
import { analyseLines, analyseRows, csvToRows, groupLines, htmlToRows } from './index.js';

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const ACCEPT = '.csv,.tsv,.txt,.xlsx,.xls,.pdf,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel';

export class StatementError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'StatementError';
    this.code = code;
  }
}

function readAsArrayBuffer(file) {
  if (typeof file.arrayBuffer === 'function') return file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsArrayBuffer(file);
  });
}

function decodeText(buf) {
  const bytes = new Uint8Array(buf);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

export function kindOf(file) {
  const name = (file?.name || '').toLowerCase();
  if (name.endsWith('.pdf')) return 'pdf';
  if (name.endsWith('.xlsx')) return 'xlsx';
  if (name.endsWith('.xls')) return 'xls';
  if (name.endsWith('.csv') || name.endsWith('.tsv') || name.endsWith('.txt')) return 'csv';
  return '';
}

/** Checks type and size before reading. Returns an error message or ''. */
export function checkFile(file) {
  if (!file) return 'Choose a file to import.';
  if (!kindOf(file)) return 'Choose a CSV, Excel (.xlsx) or PDF statement.';
  if (file.size > MAX_FILE_BYTES) return 'This file is over 10 MB. Export a shorter date range and try again.';
  if (file.size === 0) return 'This file is empty.';
  return '';
}

const startsWith = (bytes, sig) => sig.every((b, i) => bytes[i] === b);

async function readXlsx(buf) {
  const { readSheet } = await import('read-excel-file/universal');
  const rows = await readSheet(buf);
  return rows.map((r) => r.map((c) => (c === null || c === undefined ? '' : c)));
}

async function readPdf(buf, password, onProgress) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    const worker = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url');
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  }
  const task = pdfjs.getDocument({
    data: new Uint8Array(buf),
    password: password || undefined,
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    stopAtErrors: false,
  });
  let doc;
  try {
    doc = await task.promise;
  } catch (err) {
    if (err?.name === 'PasswordException') {
      const wrong = err.code === 2 || (password && err.code !== 1);
      throw new StatementError(
        wrong ? 'That password did not open the file. Check it and try again.' : 'This PDF is protected with a password.',
        wrong ? 'wrong-password' : 'need-password'
      );
    }
    throw new StatementError('This PDF could not be read. It may be damaged or a scanned image.', 'unreadable');
  }
  const items = [];
  const pages = Math.min(doc.numPages, 200);
  for (let p = 1; p <= pages; p += 1) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    content.items.forEach((it) => {
      if (!it.str) return;
      const [, , , d, x, y] = it.transform;
      items.push({ str: it.str, x, y, w: it.width, h: Math.abs(it.height || d) || 10, page: p });
    });
    // No page.cleanup() here: a cleaned page never finishes rendering its images, which OCR needs.
  }
  if (!items.length) {
    // No text layer: the bank drew the text as shapes, or the file is a scan. Read it with OCR.
    try {
      const { recognisePdf } = await import('./ocr.js');
      items.push(...(await recognisePdf(doc, { onProgress })));
    } catch (err) {
      console.error('Text recognition failed', err);
      await task.destroy();
      throw new StatementError(
        'This PDF has no text layer and text recognition could not run. Check your connection and try again, or download the statement as CSV or Excel.',
        'ocr-failed'
      );
    }
  }
  await task.destroy();
  if (!items.length) {
    throw new StatementError('No text could be found in this PDF. Download the statement as CSV or Excel instead.', 'no-text');
  }
  return groupLines(items);
}

/**
 * Reads and analyses a statement file. Returns the analysis from analyseRows or analyseLines,
 * plus { kind, fileName }. Throws StatementError with a code for password prompts and unsupported files.
 */
export async function readStatement(file, { password, onProgress } = {}) {
  const problem = checkFile(file);
  if (problem) throw new StatementError(problem, 'invalid-file');
  const kind = kindOf(file);
  const buf = await readAsArrayBuffer(file);
  const bytes = new Uint8Array(buf.slice(0, 8));
  let result;

  if (kind === 'pdf') {
    if (!startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) throw new StatementError('This file is not a PDF, even though its name ends in .pdf.', 'invalid-file');
    result = analyseLines(await readPdf(buf, password, onProgress));
  } else if (kind === 'xlsx' || (kind === 'xls' && startsWith(bytes, [0x50, 0x4b]))) {
    try {
      result = analyseRows(await readXlsx(buf));
    } catch {
      throw new StatementError('This Excel file could not be read. Save it again as .xlsx or .csv and retry.', 'unreadable');
    }
  } else if (kind === 'xls') {
    if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0])) {
      throw new StatementError(
        'Older .xls files cannot be read in the browser. Open the file in Excel or Google Sheets, save it as .xlsx or .csv, then import that.',
        'xls-unsupported'
      );
    }
    // Many banks send ".xls" files that are really HTML tables or tab-separated text.
    const text = decodeText(buf);
    result = analyseRows(/<table[\s>]/i.test(text) ? htmlToRows(text) : csvToRows(text));
  } else {
    result = analyseRows(csvToRows(decodeText(buf)));
  }
  return { ...result, kind, fileName: file.name };
}
