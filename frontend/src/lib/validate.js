// Client-side validation that mirrors the API rules, so errors show before a round trip.
// Every form and the statement importer use these same rules.

export const LIMITS = {
  amountMax: 1e9,
  description: 200,
  notes: 500,
  category: 50,
  title: 100,
  name: 60,
  email: 254,
  search: 100,
  passwordMin: 8,
  passwordMax: 72,
  amountChars: 16,
};

export const MAX_AMOUNT = LIMITS.amountMax;

export const PAYMENT_METHODS = [
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank' },
  { value: 'wallet', label: 'Wallet' },
  { value: 'other', label: 'Other' },
];

export const paymentLabel = (v) => PAYMENT_METHODS.find((m) => m.value === v)?.label || 'Other';
export const isPaymentMethod = (v) => PAYMENT_METHODS.some((m) => m.value === v);

export const PASSWORD_RULES = [
  { id: 'length', label: '8 to 72 characters', test: (p) => p.length >= 8 && p.length <= 72 },
  { id: 'upper', label: 'An uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { id: 'lower', label: 'A lowercase letter', test: (p) => /[a-z]/.test(p) },
  { id: 'digit', label: 'A number', test: (p) => /\d/.test(p) },
];

export function passwordChecks(password = '') {
  return PASSWORD_RULES.map((r) => ({ id: r.id, label: r.label, ok: r.test(password) }));
}

export const isStrongPassword = (p) => passwordChecks(p).every((c) => c.ok);

export const isEmail = (v = '') => {
  const s = v.trim();
  return s.length <= LIMITS.email && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
};

/** "1,250.50" -> 1250.5. Blank or malformed text gives NaN. */
export function parseAmount(v) {
  if (typeof v === 'number') return v;
  const s = String(v ?? '')
    .replace(/[,\s]/g, '')
    .trim();
  if (s === '' || !/^[-+]?\d*\.?\d+$/.test(s)) return NaN;
  return Number(s);
}

const decimals = (n) => {
  if (!Number.isFinite(n)) return 0;
  const s = String(n);
  if (s.includes('e-')) return 10;
  return (s.split('.')[1] || '').length;
};

/** Amount rule shared with the API: more than 0, at most 1,000,000,000, at most 2 decimals. */
export function validateAmount(v, { label = 'Amount', allowZero = false } = {}) {
  const n = parseAmount(v);
  if (Number.isNaN(n)) return String(v ?? '').trim() === '' ? `Enter ${/^[aeiou]/i.test(label) ? 'an' : 'a'} ${label.toLowerCase()}.` : `${label} must be a number, like 1250.50.`;
  if (allowZero ? n < 0 : n <= 0) return allowZero ? `${label} must be zero or more.` : `${label} must be more than zero.`;
  if (n > MAX_AMOUNT) return `${label} must be 1,000,000,000 or less.`;
  if (decimals(n) > 2) return `${label} can have at most 2 decimal places.`;
  return '';
}

export const CATEGORY_PATTERN = /^[\p{L}\p{N} &\-/.,'()]+$/u;

export function validateCategory(v = '') {
  const s = String(v).trim();
  if (!s) return 'Enter a category.';
  if (s.length > LIMITS.category) return `Keep the category to ${LIMITS.category} characters or fewer.`;
  if (!CATEGORY_PATTERN.test(s)) return "Use letters, numbers, spaces and & - / . , ' ( ) only.";
  return '';
}

export function validateDescription(v = '', { required = false } = {}) {
  const s = String(v).trim();
  if (!s && required) return 'Describe the entry.';
  if (s.length > LIMITS.description) return `Keep the description to ${LIMITS.description} characters or fewer.`;
  return '';
}

export function validateNotes(v = '') {
  if (String(v).trim().length > LIMITS.notes) return `Keep notes to ${LIMITS.notes} characters or fewer.`;
  return '';
}

const pad = (n) => String(n).padStart(2, '0');
const localIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const MIN_DATE = '1970-01-01';
/** Latest date the API accepts: tomorrow, local time. */
export function maxEntryDate(today = new Date()) {
  return localIso(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1));
}
export const todayIso = (today = new Date()) => localIso(today);

export function isRealDay(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function validateEntryDate(v, { required = false, today = new Date() } = {}) {
  if (!v) return required ? 'Enter a date.' : '';
  if (!isRealDay(v)) return 'Use a valid date.';
  if (v < MIN_DATE) return 'Dates before 1970 are not accepted.';
  if (v > maxEntryDate(today)) return 'The date cannot be more than a day in the future.';
  return '';
}

export function validateType(v) {
  return v === 'income' || v === 'expense' ? '' : 'Choose income or spending.';
}

export function validateTransaction(values, { today } = {}) {
  const { description = '', notes = '', amount, type, category = '', date, payment_method } = values;
  const errors = {};
  const checks = {
    description: validateDescription(description),
    notes: validateNotes(notes),
    amount: validateAmount(amount),
    type: validateType(type),
    category: validateCategory(category),
    date: validateEntryDate(date, { today }),
    payment_method: payment_method && !isPaymentMethod(payment_method) ? 'Choose a payment method.' : '',
  };
  Object.entries(checks).forEach(([k, msg]) => {
    if (msg) errors[k] = msg;
  });
  return errors;
}

export function validateName(v = '') {
  const s = String(v).trim();
  if (!s) return 'Enter your name.';
  if (s.length > LIMITS.name) return `Keep the name to ${LIMITS.name} characters or fewer.`;
  if (!/^[\p{L} .'-]+$/u.test(s)) return "Use letters, spaces and . ' - only.";
  return '';
}

export function validateEmail(v = '') {
  const s = String(v).trim();
  if (!s) return 'Enter your email.';
  if (s.length > LIMITS.email) return `Keep the email to ${LIMITS.email} characters or fewer.`;
  if (!isEmail(s)) return 'Enter an email like name@example.com.';
  return '';
}

export function validateTitle(v = '') {
  const s = String(v).trim();
  if (!s) return 'Name the goal.';
  if (s.length > LIMITS.title) return `Keep the name to ${LIMITS.title} characters or fewer.`;
  return '';
}

/** Savings goal: title, target, saved so far (0 to 10x target) and a due date not in the past on create. */
export function validateGoal({ title, target, current, due }, { isNew = true, today = new Date() } = {}) {
  const errors = {};
  const t = validateTitle(title);
  if (t) errors.title = t;
  const tg = validateAmount(target, { label: 'Target' });
  if (tg) errors.target = tg;
  if (String(current ?? '').trim() !== '') {
    const c = validateAmount(current, { label: 'Saved so far', allowZero: true });
    if (c) errors.current = c;
    else if (!tg && parseAmount(current) > parseAmount(target) * 10) errors.current = 'Saved so far can be at most 10 times the target.';
  }
  if (due) {
    if (!isRealDay(due)) errors.due = 'Use a valid date.';
    else if (isNew && due < todayIso(today)) errors.due = 'Choose today or a later date.';
  }
  return errors;
}

/** Add to or take from a goal. Returns an error message or ''. */
export function validateGoalMove(amount, goal, mode) {
  const base = validateAmount(amount);
  if (base) return base;
  const n = parseAmount(amount);
  if (mode === 'withdraw') {
    if (n > goal.current_amount) return 'You cannot withdraw more than has been saved.';
    return '';
  }
  const next = goal.current_amount + n;
  if (next > MAX_AMOUNT) return 'The new total would be over 1,000,000,000.';
  if (next > goal.target_amount * 10) return 'The new total would be more than 10 times the target.';
  return '';
}

export function validateBudget({ category, limit }, { isNew = true } = {}) {
  const errors = {};
  if (isNew) {
    const c = validateCategory(category);
    if (c) errors.category = c;
  }
  const l = validateAmount(limit, { label: 'Limit' });
  if (l) errors.limit = l;
  return errors;
}

/**
 * The API reports problems as error.details, a list like ["amount must be greater than 0"].
 * Returns { field: message } for fields this form knows, plus the rest under _form.
 */
export function fieldErrorsFrom(err, fields = []) {
  const details = err?.body?.error?.details;
  const list = Array.isArray(details) ? details : err?.message ? String(err.message).split(/,\s*/) : [];
  const out = {};
  const rest = [];
  list.forEach((raw) => {
    const line = typeof raw === 'string' ? raw : raw?.message || '';
    const field = fields.find((f) => new RegExp(`^${f}\\b`, 'i').test(line) || (typeof raw === 'object' && raw?.field === f));
    if (field && !out[field]) {
      const human = line.replace(/_/g, ' ');
      out[field] = `${human[0].toUpperCase()}${human.slice(1)}${/[.!?]$/.test(human) ? '' : '.'}`;
    } else if (line) rest.push(line);
  });
  if (rest.length && Object.keys(out).length === 0) out._form = err?.message || rest.join(', ');
  else if (rest.length) out._form = rest.join(', ');
  return out;
}
