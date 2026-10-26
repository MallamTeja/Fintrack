// Money and date formatting. INR uses Indian digit grouping (1,23,456.00).

export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD', 'JPY'];

export const CURRENCY_NAMES = {
  INR: 'Indian rupee',
  USD: 'US dollar',
  EUR: 'Euro',
  GBP: 'British pound',
  AED: 'UAE dirham',
  SGD: 'Singapore dollar',
  AUD: 'Australian dollar',
  CAD: 'Canadian dollar',
  JPY: 'Japanese yen',
};

const LOCALE = {
  INR: 'en-IN',
  USD: 'en-US',
  EUR: 'en-IE',
  GBP: 'en-GB',
  AED: 'en-AE',
  SGD: 'en-SG',
  AUD: 'en-AU',
  CAD: 'en-CA',
  JPY: 'en-JP',
};

/** Currencies written without minor units. */
const NO_DECIMALS = new Set(['JPY']);

const cache = new Map();
function nf(currency, opts = {}) {
  const key = `${currency}|${JSON.stringify(opts)}`;
  if (!cache.has(key)) {
    cache.set(
      key,
      new Intl.NumberFormat(LOCALE[currency] || 'en-IN', {
        style: 'currency',
        currency,
        minimumFractionDigits: NO_DECIMALS.has(currency) ? 0 : 2,
        maximumFractionDigits: NO_DECIMALS.has(currency) ? 0 : 2,
        ...opts,
      })
    );
  }
  return cache.get(key);
}

export function normaliseCurrency(c) {
  return CURRENCIES.includes(c) ? c : 'INR';
}

/** formatMoney(123456, 'INR') -> "₹1,23,456.00". Negative values use a true minus sign. */
export function formatMoney(amount, currency = 'INR', opts) {
  const n = Number(amount) || 0;
  const s = nf(normaliseCurrency(currency), opts).format(Math.abs(n));
  return n < 0 ? `−${s}` : s;
}

/**
 * Compact label for chart axes, e.g. "₹1.2L", "₹50K" or "$12K".
 * INR is spelled out by hand: the en-IN compact form writes thousands as "T", which reads as trillion.
 */
export function formatCompact(amount, currency = 'INR') {
  const c = normaliseCurrency(currency);
  if (c === 'INR') {
    const n = Number(amount) || 0;
    const a = Math.abs(n);
    const [div, unit] = a >= 1e7 ? [1e7, 'Cr'] : a >= 1e5 ? [1e5, 'L'] : a >= 1e3 ? [1e3, 'K'] : [1, ''];
    const v = div === 1 ? Math.round(a) : Math.round((a / div) * 10) / 10;
    return `${n < 0 ? '−' : ''}₹${String(v)}${unit}`;
  }
  return new Intl.NumberFormat(LOCALE[c], {
    style: 'currency',
    currency: c,
    notation: 'compact',
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(Number(amount) || 0);
}

/**
 * Splits a formatted amount so the symbol and decimals can be set quieter than the figure.
 * Returns { sign, symbol, whole, fraction, symbolFirst }.
 */
export function moneyParts(amount, currency = 'INR', { decimals = true } = {}) {
  const n = Number(amount) || 0;
  const opts = decimals ? undefined : { minimumFractionDigits: 0, maximumFractionDigits: 0 };
  const parts = nf(normaliseCurrency(currency), opts).formatToParts(Math.abs(n));
  let symbol = '';
  let whole = '';
  let fraction = '';
  let seenSymbol = false;
  let symbolFirst = true;
  for (const p of parts) {
    if (p.type === 'currency') {
      symbol = p.value;
      seenSymbol = true;
    } else if (p.type === 'integer' || p.type === 'group') {
      if (!seenSymbol) symbolFirst = false;
      whole += p.value;
    } else if (p.type === 'decimal' || p.type === 'fraction') {
      fraction += p.value;
    }
  }
  return { sign: n < 0 ? '−' : '', symbol, whole, fraction, symbolFirst };
}

// Dates: the API sends ISO strings or YYYY-MM-DD. We read the calendar day to avoid timezone drift.
export function toDay(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return isoDay(d);
}

export function isoDay(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDay(day) {
  const [y, m, d] = toDay(day).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

// Display date format, set from the user's preferences (see AuthContext).
export const DATE_FORMATS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];
let dateFormat = 'DD/MM/YYYY';

export function setDateFormat(f) {
  dateFormat = DATE_FORMATS.includes(f) ? f : 'DD/MM/YYYY';
}
export const getDateFormat = () => dateFormat;

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Short day label: "26 Oct", or "Oct 26" when the user writes the month first. */
export function formatDay(v, format = dateFormat) {
  if (!v) return '';
  const d = parseDay(v);
  const day = String(d.getDate()).padStart(2, '0');
  const mon = SHORT_MONTHS[d.getMonth()];
  return format === 'DD/MM/YYYY' ? `${day} ${mon}` : `${mon} ${day}`;
}

/** Full date in the user's chosen format: 26/10/2026, 10/26/2026 or 2026-10-26. */
export function formatDate(v, format = dateFormat) {
  if (!v) return '';
  const day = toDay(v);
  if (!day) return '';
  const [y, m, d] = day.split('-');
  if (format === 'YYYY-MM-DD') return `${y}-${m}-${d}`;
  if (format === 'MM/DD/YYYY') return `${m}/${d}/${y}`;
  return `${d}/${m}/${y}`;
}

const monthFmt = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' });
const shortMonthFmt = new Intl.DateTimeFormat('en-IN', { month: 'short' });

export const formatMonth = (d) => monthFmt.format(d);
export const formatShortMonth = (d) => shortMonthFmt.format(d);

export function monthRange(date = new Date(), offset = 0) {
  const start = new Date(date.getFullYear(), date.getMonth() + offset, 1);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  return { start, end, startDate: isoDay(start), endDate: isoDay(end) };
}

export function monthKey(v) {
  return toDay(v).slice(0, 7);
}

/** Whole months from today until a due date; negative when overdue. */
export function monthsUntil(day, today = new Date()) {
  const d = parseDay(day);
  return (d.getFullYear() - today.getFullYear()) * 12 + (d.getMonth() - today.getMonth());
}

export function percent(part, whole) {
  if (!whole || whole <= 0) return 0;
  return Math.max(0, (Number(part) / Number(whole)) * 100);
}
