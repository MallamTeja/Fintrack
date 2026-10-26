// Pure entry points for statement parsing. File reading lives in readers.js.
import Papa from 'papaparse';
import { linesToTable } from './layout.js';
import { buildDrafts, detectHeader, inferMapping, isCompleteMapping } from './table.js';
import { countUpiEvents, parseUpiText } from './upi.js';
import { validateDraft } from './validateDraft.js';

export { ROLES, ROLE_LABELS, isCompleteMapping } from './table.js';
export { groupLines } from './layout.js';
export { toImportRow, validateDraft } from './validateDraft.js';

export const MAX_ROWS = 5000;

/** CSV or TSV text to rows of trimmed strings. Delimiter is detected. */
export function csvToRows(text) {
  const clean = String(text || '').replace(/^﻿/, '');
  const out = Papa.parse(clean, { skipEmptyLines: 'greedy', delimiter: '' });
  return out.data.map((r) => (Array.isArray(r) ? r.map((c) => (typeof c === 'string' ? c.trim() : c)) : []));
}

/** Table rows from an HTML document (some banks save ".xls" files that are really HTML tables). */
export function htmlToRows(html) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  return [...doc.querySelectorAll('tr')].map((tr) =>
    [...tr.querySelectorAll('th,td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim())
  );
}

/**
 * Analyses a table. Returns
 * { layout: 'table', rows, headerRow, mapping, confidence, drafts, skipped, dayFirst, headers }.
 * confidence 'low' means the column mapping step should be shown.
 */
export function analyseRows(rows, { mapping: forced, headerRow: forcedHeader, dayFirst } = {}) {
  const table = rows.slice(0, MAX_ROWS + 60);
  let found;
  if (forced) found = { headerRow: forcedHeader ?? -1, mapping: forced, confidence: isCompleteMapping(forced) ? 'high' : 'low' };
  else found = detectHeader(table) || inferMapping(table);
  const built = isCompleteMapping(found.mapping) || found.mapping.date !== undefined
    ? buildDrafts(table, { headerRow: found.headerRow, mapping: found.mapping, dayFirst })
    : { drafts: [], skipped: 0, dayFirst: true };
  const headers = found.headerRow >= 0 ? (table[found.headerRow] || []).map((h) => String(h ?? '')) : [];
  return {
    layout: 'table',
    rows: table,
    headerRow: found.headerRow,
    mapping: found.mapping,
    confidence: built.drafts.length ? found.confidence : 'low',
    drafts: built.drafts.slice(0, MAX_ROWS),
    truncated: built.drafts.length > MAX_ROWS,
    skipped: built.skipped,
    dayFirst: built.dayFirst,
    headers,
  };
}

/**
 * Analyses PDF lines (from groupLines). Bank statements are read as tables;
 * PhonePe, Google Pay and Paytm statements as text entries.
 */
export function analyseLines(lines) {
  const upiCount = countUpiEvents(lines);
  const table = linesToTable(lines);
  let tableResult = null;
  if (table) tableResult = analyseRows(table.rows, { mapping: table.mapping, headerRow: table.headerRow });
  if (upiCount > 0 && (!tableResult || upiCount > tableResult.drafts.length)) {
    const upi = parseUpiText(lines);
    if (upi.drafts.length) {
      return {
        layout: 'upi',
        rows: [],
        headerRow: -1,
        mapping: {},
        confidence: 'high',
        drafts: upi.drafts.slice(0, MAX_ROWS),
        truncated: upi.drafts.length > MAX_ROWS,
        skipped: upi.skipped,
        dayFirst: true,
        headers: [],
      };
    }
  }
  if (tableResult) return tableResult;
  // No header and no UPI entries: offer the mapping step on the raw cells.
  return analyseRows(lines.map((l) => l.cells.map((c) => c.text)));
}

const dupKey = (d) => `${d.date}|${d.type}|${Number(d.amount).toFixed(2)}`;

/**
 * Marks drafts that may already exist: `dup: 'file'` when the same day, type, amount and description
 * appears earlier in this file, `dup: 'ledger'` when the ledger has an entry on that day with the same
 * type and amount. The server makes the final call.
 */
export function markDuplicates(drafts, existing = []) {
  const ledger = new Set(existing.map((t) => dupKey(t)));
  const seen = new Set();
  return drafts.map((d) => {
    const fileKey = `${dupKey(d)}|${(d.description || '').trim().toLowerCase()}`;
    let dup = '';
    if (ledger.has(dupKey(d))) dup = 'ledger';
    else if (seen.has(fileKey)) dup = 'file';
    seen.add(fileKey);
    return dup === d.dup ? d : { ...d, dup };
  });
}

/** Re-validates a draft after the user edits it in the preview. */
export function editDraft(d, patch) {
  const next = { ...d, ...patch };
  next.errors = validateDraft(next);
  if (Object.keys(next.errors).length) next.include = false;
  else if (Object.keys(d.errors || {}).length) next.include = true;
  return next;
}

/** Totals over included, valid rows: { count, income, expense, from, to }. */
export function draftTotals(drafts) {
  const t = { count: 0, income: 0, expense: 0, from: '', to: '' };
  drafts.forEach((d) => {
    if (!d.include || Object.keys(d.errors || {}).length) return;
    t.count += 1;
    if (d.type === 'income') t.income += d.amount;
    else t.expense += d.amount;
    if (!t.from || d.date < t.from) t.from = d.date;
    if (!t.to || d.date > t.to) t.to = d.date;
  });
  t.income = Math.round(t.income * 100) / 100;
  t.expense = Math.round(t.expense * 100) / 100;
  return t;
}
