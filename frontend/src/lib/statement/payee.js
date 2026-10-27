// Who a statement line is with: a stable key for grouping (the UPI handle when there is one)
// and a readable name, with names that a bank wrapped or cut short put back together.

const UPI_HANDLE_RE = /([A-Za-z0-9._-]+) ?@/;
// Union Bank style ".../DR/NAME/SBIN/handle": the handle follows a four letter bank code.
const AFTER_BANK_CODE_RE = /\/[A-Z]{4}\/ ?([A-Za-z0-9._-]{3,})/;

/** Known businesses, matched on the squashed lowercase name, shown with their usual spelling. */
const BRANDS = [
  [/^swiggy/, 'Swiggy'],
  [/^zomato/, 'Zomato'],
  [/^flipkar/, 'Flipkart'],
  [/^amazon|^amzn/, 'Amazon'],
  [/^myntra/, 'Myntra'],
  [/^relianc/, 'Reliance'],
  [/^jio/, 'Jio'],
  [/^airtel/, 'Airtel'],
  [/^boat$/, 'boAt'],
  [/^shadowfa/, 'Shadowfax'],
  [/^dmart|^avenuesuper/, 'DMart'],
  [/^bigbasket|^supermarketgr/, 'BigBasket'],
  [/^blinkit/, 'Blinkit'],
  [/^zepto/, 'Zepto'],
  [/^uber/, 'Uber'],
  [/^ola/, 'Ola'],
  [/^rapido/, 'Rapido'],
  [/^irctc/, 'IRCTC'],
  [/^netflix/, 'Netflix'],
  [/^spotify/, 'Spotify'],
  [/^phonepe/, 'PhonePe'],
  [/^googlepay|^gpay/, 'Google Pay'],
  [/^bharatpe/, 'BharatPe'],
  [/^paytm/, 'Paytm'],
];

/** The brand name for a payee name, or ''. */
export function brandName(name = '') {
  const squashed = String(name).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (squashed.length < 3) return '';
  const hit = BRANDS.find(([re]) => re.test(squashed));
  return hit ? hit[1] : '';
}

/**
 * Banks print narrations in a narrow column and break long names mid-word, so "PULLAIAH"
 * arrives as "PULLAIA H" and "FLIPKART" as "FLIPKAR T". A one or two letter piece after a
 * word is joined back on: two letters after a word of six or more ("VENNAP US"), one letter
 * after a word of seven or more ("PULLAIA H"). Anything shorter is more likely an initial
 * ("BALAJI C", "SRI SAI J") and is left alone.
 */
export function joinWrappedName(name = '') {
  return String(name)
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(\p{L}{6,}) (\p{L}{2})$/u, '$1$2')
    .replace(/(\p{L}{7,}) (\p{L})$/u, '$1$2');
}

/** UPI handle such as "9866352390-2@ybl" found in a narration, or ''. */
export function upiIdFrom(raw = '') {
  const m = String(raw).match(/[A-Za-z0-9._-]+@[A-Za-z][A-Za-z0-9.]*/);
  return m ? m[0] : '';
}

/**
 * Grouping key for the person or business on a statement line:
 * "name:<brand>" for known businesses, "upi:<handle before @>" when the narration has a UPI
 * handle, else "name:<lowercase name>" when a name was read from a packed narration, else ''.
 * The backfill in supabase/migrations/20261027000000_payees.sql covers the plain handle case.
 */
export function payeeKeyFrom(raw = '', name = '') {
  // A business is one payee however many handles it collects with (swiggy@icici, swiggy.refunds).
  const brand = brandName(name);
  if (brand) return `name:${brand.toLowerCase()}`;
  const m = String(raw).match(UPI_HANDLE_RE) || String(raw).match(AFTER_BANK_CODE_RE);
  if (m && m[1].length <= 116 && /\p{L}|\d{5,}/u.test(m[1])) return `upi:${m[1].toLowerCase()}`;
  const n = String(name).toLowerCase().replace(/\s+/g, ' ').trim();
  if (n.length >= 1 && n.length <= 115 && /\p{L}{2,}/u.test(n) && /^[\p{Ll}\p{Lo}\p{M}\p{N} ._@&'-]+$/u.test(n)) return `name:${n}`;
  return '';
}
