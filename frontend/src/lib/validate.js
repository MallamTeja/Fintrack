// Client-side validation that mirrors the API rules, so errors show before a round trip.

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

export const isEmail = (v = '') => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

export const MAX_AMOUNT = 1e9;

export function parseAmount(v) {
  if (typeof v === 'number') return v;
  const n = Number(String(v).replace(/,/g, '').trim());
  return String(v).trim() === '' ? NaN : n;
}

export function validateAmount(v) {
  const n = parseAmount(v);
  if (Number.isNaN(n)) return 'Enter an amount.';
  if (n <= 0) return 'Amount must be more than zero.';
  if (n > MAX_AMOUNT) return 'Amount must be 1,000,000,000 or less.';
  return '';
}

export function validateCategory(v = '') {
  const s = v.trim();
  if (!s) return 'Enter a category.';
  if (s.length > 50) return 'Keep the category under 50 characters.';
  return '';
}

export function validateTransaction({ description = '', amount, type, category = '', date }) {
  const errors = {};
  const d = description.trim();
  if (!d) errors.description = 'Describe the entry.';
  else if (d.length > 200) errors.description = 'Keep the description under 200 characters.';
  const a = validateAmount(amount);
  if (a) errors.amount = a;
  if (type !== 'income' && type !== 'expense') errors.type = 'Choose income or spending.';
  const c = validateCategory(category);
  if (c) errors.category = c;
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.date = 'Use a valid date.';
  return errors;
}
