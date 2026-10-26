// Date parsing for bank and UPI statements. Everything returns a calendar day 'YYYY-MM-DD' or ''.

const MONTHS = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

const pad = (n) => String(n).padStart(2, '0');

function make(y, m, d) {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return '';
  if (m < 1 || m > 12 || d < 1 || d > 31) return '';
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return '';
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** Two-digit years: 00 to 69 are 2000s, 70 to 99 are 1900s. */
const fullYear = (y) => (y < 100 ? (y < 70 ? 2000 + y : 1900 + y) : y);

const MONTH_NAME = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';

// Ordered patterns. Each finds a date anywhere in a cell, so "05/10/2026 10:23" and "Oct 05, 2026 Paid to" both work.
const PATTERNS = [
  // 2026-10-05, 2026/10/05
  { re: /\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/, read: (m) => [Number(m[1]), Number(m[2]), Number(m[3])] },
  // 05 Oct 2026, 05-Oct-26, 5 October, 2026
  {
    re: new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?[\\s\\-/.]*${MONTH_NAME}[a-z]*[\\s\\-/.,']*(\\d{4}|\\d{2})\\b`, 'i'),
    read: (m) => [fullYear(Number(m[3])), MONTHS[m[2].toLowerCase()], Number(m[1])],
  },
  // Oct 05, 2026 or October 5 2026
  {
    re: new RegExp(`\\b${MONTH_NAME}[a-z]*[\\s\\-/.]*(\\d{1,2})(?:st|nd|rd|th)?[\\s,\\-/.']+(\\d{4}|\\d{2})\\b`, 'i'),
    read: (m) => [fullYear(Number(m[3])), MONTHS[m[1].toLowerCase()], Number(m[2])],
  },
];

const NUMERIC = /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})\b/;

/**
 * Looks at numeric dates in a column and decides whether they are day-first (Indian, the default)
 * or month-first. Returns true for day-first.
 */
export function guessDayFirst(values = []) {
  let dayFirst = 0;
  let monthFirst = 0;
  values.forEach((v) => {
    const m = NUMERIC.exec(String(v ?? ''));
    if (!m) return;
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a > 12 && b <= 12) dayFirst += 1;
    if (b > 12 && a <= 12) monthFirst += 1;
  });
  return !(monthFirst > 0 && dayFirst === 0);
}

/** Excel stores dates as days since 1899-12-30. */
export function fromExcelSerial(n) {
  if (!Number.isFinite(n) || n < 1 || n > 2958465) return '';
  const ms = Math.round((n - 25569) * 86400 * 1000);
  const d = new Date(ms);
  return make(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/**
 * parseStatementDate('05/10/2026') -> '2026-10-05' (day first by default).
 * Accepts Date objects (read as UTC, as spreadsheet readers create them), Excel serials,
 * DD/MM/YYYY, DD-MM-YY, DD.MM.YYYY, DD MMM YYYY, DD-MMM-YY, MMM DD, YYYY and YYYY-MM-DD.
 */
export function parseStatementDate(value, { dayFirst = true } = {}) {
  if (value === null || value === undefined || value === '') return '';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    return make(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  }
  if (typeof value === 'number') return value > 20000 && value < 80000 ? fromExcelSerial(value) : '';
  const s = String(value).trim();
  if (!s || s.length > 60) return '';
  for (const p of PATTERNS) {
    const m = p.re.exec(s);
    if (m) {
      const [y, mo, d] = p.read(m);
      const out = make(y, mo, d);
      if (out) return out;
    }
  }
  const m = NUMERIC.exec(s);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const y = fullYear(Number(m[3]));
    const first = dayFirst ? make(y, b, a) : make(y, a, b);
    return first || (dayFirst ? make(y, a, b) : make(y, b, a));
  }
  return '';
}

/** True when a cell holds something that reads as a date. */
export const looksLikeDate = (v, opts) => parseStatementDate(v, opts) !== '';
