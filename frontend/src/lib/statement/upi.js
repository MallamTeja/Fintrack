// PhonePe, Google Pay and Paytm statements: text lines like "Paid to Swiggy  DEBIT  ₹250".
import { payeeKeyFrom } from './payee.js';
import { parseMoney } from './amounts.js';
import { categorise } from './categorise.js';
import { parseStatementDate } from './dates.js';
import { validateDraft } from './validateDraft.js';

const EVENT =
  /\b(paid\s+to|payment\s+to|sent\s+to|money\s+sent\s+to|transferred\s+to|transfer\s+to|received\s+from|money\s+received\s+from|payment\s+from|refund\s+from|cashback\s+from|cashback\s+received|added\s+to|bill\s+paid|recharged?)\b[\s:]*(.*)$/i;

const INCOME_EVENT = /received|refund|cashback|payment\s+from/i;

/** Amount with a currency mark or after DEBIT/CREDIT; returns a positive number or null. */
function amountIn(s) {
  const m =
    /(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/i.exec(s) ||
    /\b(?:debit|credit|debited|credited)\b\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d{1,2})?)/i.exec(s);
  if (!m) return null;
  const p = parseMoney(m[1]);
  return p && p.value > 0 ? p.value : null;
}

function directionIn(s) {
  if (/(^|\s)-\s*(?:₹|rs\.?|inr)/i.test(s)) return 'expense';
  if (/(^|\s)\+\s*(?:₹|rs\.?|inr)/i.test(s)) return 'income';
  if (/\b(debit|debited)\b/i.test(s)) return 'expense';
  if (/\b(credit|credited)\b/i.test(s)) return 'income';
  return '';
}

function tidyName(rest) {
  const name = rest
    .split(/\s{2,}|\b(?:debit|credit|debited|credited)\b|[-+]?\s*₹|[-+]?\s*\b(?:rs\.?|inr)\s*(?=\d)/i)[0]
    .replace(/\b(?:on|at)\s+\d{1,2}[:.]\d{2}.*$/i, '')
    .trim();
  return name.slice(0, 120);
}

/** Counts lines that look like UPI app entries. */
export const countUpiEvents = (lines) => lines.filter((l) => EVENT.test(l.text || l)).length;

/**
 * lines: [{ text }] in reading order (or plain strings). Returns { drafts, skipped }.
 * Dates come from the entry line, else the two lines above it, else the last date seen.
 */
export function parseUpiText(lines) {
  const texts = lines.map((l) => (typeof l === 'string' ? l : l.text || '').replace(/[ \t]{3,}/g, '  ').trim());
  const drafts = [];
  let skipped = 0;
  let lastDate = '';

  texts.forEach((t, i) => {
    const m = EVENT.exec(t);
    const ownDate = parseStatementDate(t);
    if (!m) {
      if (ownDate) lastDate = ownDate;
      return;
    }
    let end = i + 1;
    while (end < texts.length && end <= i + 3 && !EVENT.test(texts[end])) end += 1;
    const window = texts.slice(i, end).join('  ');

    let date = ownDate;
    for (let k = i - 1; !date && k >= Math.max(0, i - 2); k -= 1) {
      if (EVENT.test(texts[k])) break;
      date = parseStatementDate(texts[k]);
    }
    if (!date) date = lastDate;
    if (ownDate) lastDate = ownDate;

    const amount = amountIn(t) ?? amountIn(window);
    if (!amount) {
      skipped += 1;
      return;
    }
    const type = directionIn(t) || (INCOME_EVENT.test(m[1]) ? 'income' : directionIn(window) || 'expense');
    const name = tidyName(m[2]);
    const phrase = m[1].replace(/\s+/g, ' ').toLowerCase();
    const description = (name ? `${phrase[0].toUpperCase()}${phrase.slice(1)} ${name}` : `${phrase[0].toUpperCase()}${phrase.slice(1)}`).slice(0, 200);
    const draft = {
      key: `u${i + 1}`,
      line: i + 1,
      date,
      rawDate: date ? '' : t.slice(0, 30),
      amount,
      type,
      raw: window,
      description,
      notes: '',
      payee_key: payeeKeyFrom(window, name),
      category: categorise(`${name} ${window}`, type),
      payment_method: /wallet/i.test(window) ? 'wallet' : 'upi',
      guessedType: false,
    };
    draft.errors = validateDraft(draft);
    draft.include = Object.keys(draft.errors).length === 0;
    drafts.push(draft);
  });
  return { drafts, skipped };
}
