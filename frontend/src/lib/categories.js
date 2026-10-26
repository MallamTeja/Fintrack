import { fetchCategories } from './data.js';
import { useResource } from './useResource.js';

export const DEFAULT_CATEGORIES = {
  expense: [
    'Food',
    'Groceries',
    'Rent',
    'Transport',
    'Utilities',
    'Shopping',
    'Health',
    'Subscriptions',
    'Entertainment',
    'Education',
    'Travel',
    'Fees & Charges',
    'Transfers',
    'Cash',
    'Other',
  ],
  income: ['Salary', 'Freelance', 'Interest', 'Refund', 'Cashback', 'Transfers', 'Gifts', 'Investments', 'Other income'],
};

/**
 * Suggestions for one entry type: categories already used for that type (most used first),
 * then the defaults, then anything used for the other type.
 */
export function categoryOptions(used = [], type = 'expense') {
  const list = (used || []).map((u) => (typeof u === 'string' ? { category: u, type, count: 0 } : u));
  const same = list.filter((u) => u.type === type).map((u) => u.category);
  const other = list.filter((u) => u.type !== type).map((u) => u.category);
  const seen = new Set();
  const out = [];
  [...same, ...(DEFAULT_CATEGORIES[type] || DEFAULT_CATEGORIES.expense), ...other].forEach((c) => {
    const key = c.trim().toLowerCase();
    if (c.trim() && !seen.has(key)) {
      seen.add(key);
      out.push(c.trim());
    }
  });
  return out;
}

/** Categories from the API for autocomplete. Falls back to an empty list if the call fails. */
export function useCategories() {
  const res = useResource(fetchCategories, { keys: ['categories', 'transactions'] });
  return res.data || [];
}
