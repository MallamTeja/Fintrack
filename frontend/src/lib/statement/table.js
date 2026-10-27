// Turns a statement table (rows of cells from CSV, Excel or a PDF layout) into draft transactions.
import { payeeKeyFrom } from './payee.js';
import { parseMoney, readDirection } from './amounts.js';
import { categorise, cleanDescription, paymentMethodFrom } from './categorise.js';
import { guessDayFirst, parseStatementDate } from './dates.js';
import { validateDraft } from './validateDraft.js';

export const ROLES = ['date', 'description', 'debit', 'credit', 'amount', 'direction', 'balance', 'reference'];

export const ROLE_LABELS = {
  date: 'Date',
  description: 'Description',
  debit: 'Money out (debit)',
  credit: 'Money in (credit)',
  amount: 'Amount (one column)',
  direction: 'Debit or credit marker',
  balance: 'Balance',
  reference: 'Reference',
};

const text = (v) => (v === null || v === undefined ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).trim());

export function normHeader(h) {
  return text(h)
    .toLowerCase()
    .replace(/[₹().:#_*]/g, ' ')
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Which column role a header cell names, or null. */
export function roleOfHeader(h) {
  const s = normHeader(h);
  if (!s || s.length > 40) return null;
  if (/^(dr\/cr|cr\/dr|dr cr|cr dr|debit\/credit|credit\/debit|d\/c|c\/d|type|txn type|transaction type|tran type)$/.test(s)) return 'direction';
  if (/\bbal(ance)?\b/.test(s)) return 'balance';
  if (/(withdrawal|debit|^dr$|money out|paid out)/.test(s)) return 'debit';
  if (/(deposit|credit|^cr$|money in|paid in)/.test(s)) return 'credit';
  if (/(narration|particular|description|remark|details|beneficiary|merchant|payee)/.test(s)) return 'description';
  if (/(chq|cheque|\bref\b|ref no|reference|utr|transaction id|txn id)/.test(s)) return 'reference';
  if (/(date|^dt$|\bdt\b|posting)/.test(s)) return 'date';
  if (/(amount|\bamt\b|^inr$|^value$)/.test(s)) return 'amount';
  return null;
}

const datePreference = (h) => {
  const s = normHeader(h);
  if (/value/.test(s)) return 1;
  if (/(txn|transaction|tran|posting|^date$)/.test(s)) return 3;
  return 2;
};

function mappingFromHeader(row) {
  const mapping = {};
  row.forEach((cell, i) => {
    const role = roleOfHeader(cell);
    if (!role) return;
    if (role === 'date') {
      if (mapping.date === undefined || datePreference(cell) > datePreference(row[mapping.date])) mapping.date = i;
    } else if (mapping[role] === undefined) mapping[role] = i;
  });
  return mapping;
}

function scoreMapping(m) {
  let score = 0;
  if (m.date !== undefined) score += 3;
  if (m.description !== undefined) score += 2;
  if (m.debit !== undefined && m.credit !== undefined) score += 3;
  else if (m.amount !== undefined) score += 2;
  else if (m.debit !== undefined || m.credit !== undefined) score += 1;
  if (m.direction !== undefined) score += 0.5;
  if (m.balance !== undefined) score += 0.5;
  return score;
}

const hasMoneyCols = (m) => m.amount !== undefined || m.debit !== undefined || m.credit !== undefined;

export function isCompleteMapping(m = {}) {
  return m.date !== undefined && m.description !== undefined && (m.amount !== undefined || (m.debit !== undefined && m.credit !== undefined));
}

/**
 * Finds the header row in the first 60 rows.
 * Returns { headerRow, mapping, confidence: 'high' | 'low' } or null when no row looks like a header.
 */
export function detectHeader(rows) {
  let best = null;
  const limit = Math.min(rows.length, 60);
  for (let i = 0; i < limit; i += 1) {
    const row = rows[i] || [];
    if (row.filter((c) => text(c)).length < 3) continue;
    const mapping = mappingFromHeader(row);
    if (mapping.date === undefined || !hasMoneyCols(mapping)) continue;
    const score = scoreMapping(mapping);
    if (!best || score > best.score) best = { headerRow: i, mapping, score };
  }
  if (!best) return null;
  return { headerRow: best.headerRow, mapping: best.mapping, confidence: isCompleteMapping(best.mapping) ? 'high' : 'low' };
}

/** Guesses columns from the data itself when there is no header row. Always low confidence. */
export function inferMapping(rows) {
  const sample = rows.slice(0, 200);
  const width = Math.max(0, ...sample.map((r) => r.length));
  const stats = Array.from({ length: width }, () => ({ dates: 0, nums: 0, filled: 0, textLen: 0, texts: 0 }));
  sample.forEach((r) =>
    r.forEach((c, i) => {
      const t = text(c);
      if (!t) return;
      const st = stats[i];
      st.filled += 1;
      if (c instanceof Date || (typeof c === 'string' && parseStatementDate(c))) st.dates += 1;
      else if (parseMoney(c) && parseMoney(c).value > 0) st.nums += 1;
      else {
        st.texts += 1;
        st.textLen += t.length;
      }
    })
  );
  const mapping = {};
  let bestDate = -1;
  stats.forEach((s, i) => {
    if (s.dates > 0 && (bestDate < 0 || s.dates > stats[bestDate].dates)) bestDate = i;
  });
  if (bestDate >= 0) mapping.date = bestDate;
  let bestText = -1;
  stats.forEach((s, i) => {
    if (i === bestDate || !s.texts) return;
    const avg = s.textLen / s.texts;
    if (bestText < 0 || avg * s.texts > (stats[bestText].textLen / stats[bestText].texts) * stats[bestText].texts) bestText = i;
  });
  if (bestText >= 0) mapping.description = bestText;
  const numeric = stats.map((s, i) => ({ ...s, i })).filter((s) => s.i !== bestDate && s.nums > 0 && s.nums >= s.texts);
  if (numeric.length >= 3) {
    mapping.debit = numeric[0].i;
    mapping.credit = numeric[1].i;
    mapping.balance = numeric[numeric.length - 1].i;
  } else if (numeric.length === 2) {
    const both = sample.filter((r) => parseMoney(r[numeric[0].i])?.value > 0 && parseMoney(r[numeric[1].i])?.value > 0).length;
    if (both <= sample.length * 0.1) {
      mapping.debit = numeric[0].i;
      mapping.credit = numeric[1].i;
    } else {
      mapping.amount = numeric[0].i;
      mapping.balance = numeric[1].i;
    }
  } else if (numeric.length === 1) mapping.amount = numeric[0].i;
  return { headerRow: -1, mapping, confidence: 'low' };
}

const SUMMARY_STRONG = /\b(opening\s+balance|closing\s+balance|balance\s+b\/?f|balance\s+c\/?f|brought\s+forward|carried\s+forward|b\/f|c\/f|op\.?\s?bal|cl\.?\s?bal)\b/i;
const SUMMARY_END = /\b(statement\s+summary|account\s+summary|summary\s+of\s+(?:transactions|account))\b/i;
const SUMMARY_WEAK = /\b(total|grand\s+total|statement\s+summary|summary|dr\s+count|cr\s+count|page\s+\d+(\s+of\s+\d+)?|computer\s+generated|end\s+of\s+statement|generated\s+on|registered\s+office)\b/i;

function readMoneyCols(row, mapping, signedColumn) {
  const has = (k) => mapping[k] !== undefined && mapping[k] !== null && mapping[k] !== '';
  if (has('debit') || has('credit')) {
    const d = has('debit') ? parseMoney(row[mapping.debit]) : null;
    const c = has('credit') ? parseMoney(row[mapping.credit]) : null;
    const dv = d ? d.value : 0;
    const cv = c ? c.value : 0;
    if (dv > 0 && cv > 0) return { amount: dv, type: 'expense', both: true };
    if (dv > 0) return { amount: dv, type: 'expense' };
    if (cv > 0) return { amount: cv, type: 'income' };
    if (!has('amount')) return null;
  }
  if (!has('amount')) return null;
  const a = parseMoney(row[mapping.amount]);
  if (!a || a.value <= 0) return null;
  const dir = (has('direction') && readDirection(row[mapping.direction])) || a.marker;
  if (dir === 'dr') return { amount: a.value, type: 'expense' };
  if (dir === 'cr') return { amount: a.value, type: 'income' };
  if (a.negative) return { amount: a.value, type: 'expense' };
  if (signedColumn) return { amount: a.value, type: 'income' };
  return { amount: a.value, type: 'expense', guessed: true };
}

/**
 * Builds draft rows from a table and a column mapping.
 * Returns { drafts, skipped, dayFirst }. Rows that are blank, balances, totals or page furniture are skipped;
 * a row with only narration text continues the narration of the row above.
 */
export function buildDrafts(rows, { headerRow = -1, mapping = {}, dayFirst } = {}) {
  const body = rows.slice(headerRow + 1);
  const col = (row, k) => (mapping[k] === undefined || mapping[k] === null || mapping[k] === '' ? '' : row[mapping[k]]);
  const df = dayFirst === undefined ? guessDayFirst(body.map((r) => col(r, 'date')).filter((v) => typeof v === 'string')) : dayFirst;
  const signedColumn =
    mapping.amount !== undefined && body.some((r) => parseMoney(col(r, 'amount'))?.negative) && mapping.direction === undefined;

  const drafts = [];
  let skipped = 0;
  let lastWasDraft = false;
  let ended = false;

  body.forEach((row, i) => {
    if (ended) return;
    const line = headerRow + 2 + i;
    const cells = (row || []).map(text);
    if (cells.every((c) => !c)) {
      lastWasDraft = false;
      return;
    }
    const rawDate = col(row, 'date');
    const date = parseStatementDate(rawDate, { dayFirst: df });
    const headerish = !date && (row || []).filter((c) => roleOfHeader(c)).length >= 2;
    if (headerish) {
      skipped += 1;
      lastWasDraft = false;
      return;
    }
    const narration = text(col(row, 'description')).replace(/\s+/g, ' ');
    const money = readMoneyCols(row, mapping, signedColumn);
    const allText = cells.join(' ');

    if (SUMMARY_END.test(allText) && !date) {
      // Everything after a statement summary block is totals, not entries.
      ended = true;
      skipped += body.length - i;
      return;
    }
    if (
      SUMMARY_STRONG.test(allText) ||
      (SUMMARY_WEAK.test(allText) && (!date || !money)) ||
      (!date && money && parseMoney(rawDate))
    ) {
      skipped += 1;
      lastWasDraft = false;
      return;
    }
    if (!money) {
      // Narration that wrapped onto its own line belongs to the entry above.
      if (!text(rawDate) && narration && lastWasDraft && drafts.length) {
        const prev = drafts[drafts.length - 1];
        prev.raw = `${prev.raw} ${narration}`.trim();
        Object.assign(prev, describe(prev.raw, prev.type));
        prev.errors = validateDraft(prev);
        prev.include = Object.keys(prev.errors).length === 0;
        return;
      }
      if (text(rawDate) || narration) skipped += 1;
      lastWasDraft = false;
      return;
    }
    const draft = {
      key: `r${line}`,
      line,
      date,
      rawDate: text(rawDate),
      amount: money.amount,
      type: money.type,
      raw: narration,
      guessedType: Boolean(money.guessed),
      ...describe(narration, money.type),
    };
    draft.errors = validateDraft(draft);
    if (money.both) draft.errors.amount = 'This row has both a debit and a credit.';
    draft.include = Object.keys(draft.errors).length === 0;
    drafts.push(draft);
    lastWasDraft = true;
  });

  return { drafts, skipped, dayFirst: df };
}

/** Description, notes, category and payment method from a narration. */
export function describe(narration, type) {
  const raw = String(narration || '').trim();
  const description = (cleanDescription(raw) || (type === 'income' ? 'Money in' : 'Money out')).slice(0, 200);
  const packed = raw && raw !== description;
  return {
    description,
    notes: packed ? raw.slice(0, 500) : '',
    payee_key: packed ? payeeKeyFrom(raw, description) : payeeKeyFrom(raw, ''),
    category: categorise(raw, type),
    payment_method: paymentMethodFrom(raw),
  };
}
