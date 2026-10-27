// Keyword rules that turn a bank narration into a category, a payment method and a readable description.

// Checked in order; the first rule whose pattern matches wins. `type` limits a rule to income or expense.
export const CATEGORY_RULES = [
  { category: 'Refund', type: 'income', re: /\b(refund|reversal|reversed|chargeback)\b/i },
  { category: 'Cashback', type: 'income', re: /\bcash\s?back\b/i },
  { category: 'Salary', type: 'income', re: /\b(salary|sal\s?cr|payroll|wages|stipend)\b/i },
  { category: 'Interest', type: 'income', re: /\b(int\.?\s?pd|interest|int\s?cr|int\.coll|sb\s?int)\b/i },
  { category: 'Investments', type: 'income', re: /\b(dividend|div\b|redemption|maturity)\b/i },
  { category: 'Food', re: /\b(swiggy|zomato|eatsure|dominos|domino'?s|pizza\s?hut|mcdonald'?s?|kfc|starbucks|cafe|restaurant|dunzo\s?daily|blinkit\s?cafe|faasos|behrouz|box8|chaayos|haldiram)\b/i },
  { category: 'Groceries', re: /\b(bigbasket|big\s?basket|blinkit|grofers|zepto|instamart|dmart|d\s?mart|more\s?retail|reliance\s?fresh|jiomart|nature'?s\s?basket|spencer'?s|grocery|kirana|supermarket)\b/i },
  { category: 'Transport', re: /\b(uber|ola|olacabs|rapido|irctc|indian\s?railways?|metro|dmrc|bmrcl|mmrda|redbus|fastag|toll|parking|fuel|petrol|diesel|hpcl|bpcl|iocl|indian\s?oil|bharat\s?petroleum|hp\s?petrol|shell|namma\s?yatri|blusmart|yulu)\b/i },
  { category: 'Travel', re: /\b(makemytrip|goibibo|cleartrip|yatra|ixigo|easemytrip|indigo|air\s?india|vistara|akasa|spicejet|airbnb|oyo|booking\.com|agoda|hotel)\b/i },
  { category: 'Shopping', re: /\b(amazon(?!\s?prime)|amzn|flipkart|myntra|ajio|meesho|nykaa|tata\s?cliq|snapdeal|decathlon|ikea|lifestyle|westside|pantaloons|croma|reliance\s?digital|vijay\s?sales|lenskart)\b/i },
  { category: 'Subscriptions', re: /\b(netflix|spotify|hotstar|disney|prime\s?video|amazon\s?prime|primevideo|youtube\s?premium|google\s?one|icloud|apple\.com|apple\s?services|sonyliv|zee5|jiocinema|jio\s?cinema|audible|linkedin|chatgpt|openai|adobe|microsoft|canva|notion)\b/i },
  { category: 'Utilities', re: /\b(airtel|jio(?!\s?(mart|cinema))|vodafone|vi\s?prepaid|vodafone\s?idea|bsnl|act\s?fibernet|hathway|tata\s?play|dish\s?tv|electricity|bescom|msedcl|mahadiscom|tneb|tangedco|bses|tata\s?power|adani\s?electricity|cesc|uppcl|kseb|apspdcl|tsspdcl|water\s?bill|bwssb|gas\s?bill|indane|hp\s?gas|bharat\s?gas|mahanagar\s?gas|igl|broadband|recharge|postpaid|prepaid|dth)\b/i },
  { category: 'Rent', re: /\b(rent|house\s?rent|nobroker|landlord|maintenance\s?charges?|society\s?maintenance)\b/i },
  { category: 'Health', re: /\b(pharmacy|pharma|apollo|medplus|netmeds|1mg|tata\s?1mg|pharmeasy|hospital|clinic|diagnostic|lab|practo|cult\.?fit|cultfit|gym|medical|chemist|dr\.?\s?lal|thyrocare)\b/i },
  { category: 'Education', re: /\b(school|college|university|tuition|coaching|udemy|coursera|byju'?s|unacademy|vedantu|fees?\s?payment|exam\s?fee)\b/i },
  { category: 'Entertainment', re: /\b(bookmyshow|pvr|inox|cinepolis|paytm\s?insider|steam|playstation|xbox|dream11|concert)\b/i },
  { category: 'Insurance', re: /\b(insurance|lic\b|policybazaar|hdfc\s?life|icici\s?pru|sbi\s?life|max\s?life|star\s?health|acko|digit\s?insurance|premium)\b/i },
  { category: 'Investments', type: 'expense', re: /\b(zerodha|groww|upstox|kuvera|coin\s?by|mutual\s?fund|\bmf\b|sip|nps|ppf|indmoney|smallcase|angel\s?one|5paisa)\b/i },
  { category: 'Loan & EMI', re: /\b(emi|loan|bajaj\s?fin|home\s?credit|nach|ach\s?d|ecs)\b/i },
  { category: 'Fees & Charges', re: /\b(charges?|fee|gst|annual\s?fee|sms\s?alert|min\s?bal|penalty|late\s?fee|debit\s?card\s?fee|amc)\b/i },
  { category: 'Cash', re: /\b(atm|cash\s?withdrawal|nwd|awb|cash\s?wdl|cwdr)\b/i },
  { category: 'Salary', type: 'income', re: /\bneft\b.*\b(ltd|limited|pvt|private|technologies|solutions|services|llp|inc)\b/i },
  { category: 'Transfers', re: /\b(self|own\s?account|imps|neft|rtgs|fund\s?transfer|trf|transfer)\b/i },
];

/** Category for a narration. Falls back to 'Other' for spending and 'Other income' for money in. */
export function categorise(text = '', type = 'expense') {
  const s = String(text);
  for (const rule of CATEGORY_RULES) {
    if (rule.type && rule.type !== type) continue;
    if (rule.re.test(s)) return rule.category;
  }
  return type === 'income' ? 'Other income' : 'Other';
}

/** Payment method from the narration: upi, card, cash, bank, wallet or other. */
export function paymentMethodFrom(text = '') {
  const s = String(text);
  if (/\b(upi(?:a[rb])?|vpa|@ok[a-z]+|@ybl|@paytm|@ibl|@axl|@apl|phonepe|google\s?pay|gpay|bhim)\b|@[a-z]{2,}\b/i.test(s)) return 'upi';
  if (/\b(paytm\s?wallet|wallet|amazon\s?pay\s?balance|mobikwik|freecharge)\b/i.test(s)) return 'wallet';
  if (/\b(atm|cash\s?withdrawal|nwd|cash\s?wdl|cash\s?deposit|cdm|by\s?cash)\b/i.test(s)) return 'cash';
  if (/\b(pos|card|visa|mastercard|rupay|debit\s?card|credit\s?card|ecom|vps|ipay)\b/i.test(s)) return 'card';
  if (/\b(neft|imps|rtgs|nach|ach|ecs|cheque|chq|clg|transfer|trf|int\.?\s?pd|interest|salary)\b/i.test(s)) return 'bank';
  return 'other';
}

const NOISE = new Set([
  'upi', 'upiar', 'upiab', 'dr', 'cr', 'p2m', 'p2a', 'p2p', 'to', 'from', 'by', 'via', 'transfer', 'trf', 'payment', 'pay', 'paid', 'sent',
  'received', 'using', 'na', 'nil', 'imps', 'neft', 'rtgs', 'mmt', 'pos', 'ecom', 'vps', 'ipay', 'inb', 'mb', 'ib', 'ref',
  'txn', 'utr', 'collect', 'request', 'mandate', 'others', 'other', 'upiintent', 'upi intent', 'cms', 'ach', 'nach',
  'debit', 'credit', 'card', 'xx', 'no', 'for',
]);

// Bank codes and handles that appear inside UPI narrations.
const BANK_CODES = /^(yesb|icic|hdfc|sbin|utib|kkbk|punb|barb|airp|pytm|idib|cnrb|ubin|indb|fdrl|idfb|aubl|ratn|ioba|maha|cbin|ucba|bkid|psib|jaka|kvbl|tmbl|sibl|dbss|scbl|citi|hsbc|esfb|ujvn|fino|jsfb|ybl|ibl|axl|apl|okaxis|okicici|okhdfcbank|oksbi|paytm|icici|hdfcbank|axisbank|sbi|kotak|axis|yes|idfc|ptyes|ptsbi|pthdfc|ptaxis)$/i;

function titleCase(s) {
  return s
    .toLowerCase()
    .replace(/(^|[\s&\-/.(])([\p{L}])/gu, (_, a, b) => a + b.toUpperCase())
    .replace(/\b(Upi|Atm|Emi|Neft|Imps|Lic|Irctc|Ola|Kfc|Pvr|Hp|Igl|Dmart)\b/g, (w) =>
      ({ Upi: 'UPI', Atm: 'ATM', Emi: 'EMI', Neft: 'NEFT', Imps: 'IMPS', Lic: 'LIC', Irctc: 'IRCTC', Ola: 'Ola', Kfc: 'KFC', Pvr: 'PVR', Hp: 'HP', Igl: 'IGL', Dmart: 'DMart' })[w]
    );
}

const isNoiseToken = (t) => {
  const s = t.trim();
  if (!s) return true;
  const low = s.toLowerCase();
  if (NOISE.has(low) || low.split(/\s+/).every((w) => NOISE.has(w))) return true;
  if (BANK_CODES.test(s)) return true;
  if (/@/.test(s)) return true; // UPI handle
  if (/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(s)) return true; // IFSC
  if (/^[\d\s:.xX*]+$/.test(s)) return true; // references, times, masked numbers
  if (/^[a-z]*\d{6,}[a-z\d]*$/i.test(s)) return true; // long reference ids
  if (s.length <= 1) return true;
  return false;
};

/**
 * Turns "UPI-SWIGGY-SWIGGY@ICICI-ICIC0DC0099-412345678901-PAYMENT" into "Swiggy".
 * Narrations that are not packed this way are tidied (spaces collapsed) and kept.
 */
export function cleanDescription(raw = '') {
  const text = String(raw).replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const packed = (text.match(/[/\-*|]/g) || []).length >= 2 && /^(?:(?:to|by)\s+(?:transfer|trf)[\s-]*)?(upi(?:a[rb])?|imps|neft|rtgs|mmt|pos|ecom|vps|ach|nach|inb|mb|ib)\b/i.test(text);
  if (!packed) {
    const atm = /^(?:atm|nwd|awb)\b/i.test(text);
    if (atm) return 'ATM cash withdrawal';
    return text.slice(0, 200);
  }
  const tokens = text.split(/\s*[/|*\-]\s*/);
  const name = tokens.map((t) => t.trim()).find((t) => !isNoiseToken(t) && /\p{L}{2,}/u.test(t));
  if (!name) return text.slice(0, 200);
  return titleCase(name).slice(0, 200);
}
