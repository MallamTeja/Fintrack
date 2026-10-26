// Money parsing for statements: "₹1,23,456.00", "Rs. 500", "INR 250", "1,234.50 Dr", "(500.00)", "-500", "500-".

/**
 * Returns { value, negative, marker } or null when the cell has no amount.
 * value is always positive and rounded to 2 decimals. marker is 'dr', 'cr' or ''.
 */
export function parseMoney(input) {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input === 0) return input === 0 ? { value: 0, negative: false, marker: '' } : null;
    return { value: Math.round(Math.abs(input) * 100) / 100, negative: input < 0, marker: '' };
  }
  let s = String(input).trim();
  if (!s || s.length > 40) return null;
  let marker = '';
  const mk = /\b(dr|cr|debit|credit|d|c)\.?\s*$/i.exec(s) || /^(dr|cr)\.?\b/i.exec(s);
  if (mk) {
    marker = mk[1].toLowerCase().startsWith('d') ? 'dr' : 'cr';
    s = s.replace(mk[0], '').trim();
  }
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1).trim();
  }
  s = s.replace(/^(?:inr|rs\.?|₹|\$|usd|aed)\s*/i, '').replace(/\s*(?:inr|rs\.?|₹)$/i, '');
  if (/^[-−–]/.test(s)) {
    negative = true;
    s = s.replace(/^[-−–]\s*/, '');
  } else if (/^\+/.test(s)) {
    s = s.slice(1);
  } else if (/-$/.test(s)) {
    negative = true;
    s = s.slice(0, -1);
  }
  s = s.replace(/^(?:inr|rs\.?|₹)\s*/i, '');
  // Digit groups with commas (Indian 1,23,456 or western 123,456) or spaces between groups.
  if (!/^\d{1,3}(?:[,\s]\d{2,3})*(?:\.\d+)?$|^\d+(?:\.\d+)?$|^\.\d+$/.test(s)) return null;
  const n = Number(s.replace(/[,\s]/g, ''));
  if (!Number.isFinite(n)) return null;
  return { value: Math.round(n * 100) / 100, negative, marker };
}

/** First money-looking figure in free text, preferring one with a currency mark. */
export function findAmountInText(text = '') {
  const withMark = /(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/i.exec(text);
  if (withMark) {
    const p = parseMoney(withMark[1]);
    if (p && p.value > 0) return p.value;
  }
  return null;
}

/** Reads a debit/credit indicator cell such as "Dr", "CR", "Debit", "Withdrawal", "D". */
export function readDirection(v) {
  const s = String(v ?? '')
    .trim()
    .toLowerCase();
  if (!s) return '';
  if (/^(dr|d|debit|debited|withdrawal|withdraw|paid|sent|out|expense|spent)\.?$/.test(s)) return 'dr';
  if (/^(cr|c|credit|credited|deposit|received|in|income|refund)\.?$/.test(s)) return 'cr';
  return '';
}
