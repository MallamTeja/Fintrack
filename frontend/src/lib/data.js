// Resource fetchers and normalisers. Pages call these through useResource.
import { del, get, idOf, patch, post, put, toQuery, unwrap } from './api.js';
import { toDay } from './format.js';

const num = (v) => Number(v) || 0;

export const normTx = (t) => ({ ...t, id: idOf(t), amount: num(t.amount), date: toDay(t.date || t.created_at) });
export const normBudget = (b) => ({ ...b, id: idOf(b), limit: num(b.limit), current_spending: num(b.current_spending) });
export const normGoal = (g) => ({
  ...g,
  id: idOf(g),
  target_amount: num(g.target_amount),
  current_amount: num(g.current_amount),
  due_date: g.due_date ? toDay(g.due_date) : '',
});

export async function fetchTransactions(params, signal) {
  const body = await get(`/transactions${toQuery(params)}`, { signal });
  const rows = (unwrap(body) || []).map(normTx);
  const pagination = body?.pagination || { page: 1, limit: rows.length, total: rows.length, totalPages: 1 };
  return { rows, pagination };
}

/**
 * Every transaction in a date range, 500 per request, following pagination.totalPages.
 * Stops after maxPages; truncated tells the caller the figures may be incomplete.
 */
export async function fetchAllTransactions({ startDate, endDate, limit = 500, maxPages = 10 }, signal) {
  const first = await fetchTransactions({ startDate, endDate, limit, page: 1 }, signal);
  const totalPages = Math.max(1, Number(first.pagination.totalPages) || 1);
  const last = Math.min(totalPages, maxPages);
  const rest = await Promise.all(
    Array.from({ length: last - 1 }, (_, i) => fetchTransactions({ startDate, endDate, limit, page: i + 2 }, signal))
  );
  const rows = [first, ...rest].flatMap((r) => r.rows);
  return { rows, truncated: totalPages > maxPages };
}

export async function fetchSummary(params, signal) {
  const body = await get(`/transactions/stats/summary${toQuery(params)}`, { signal });
  const d = unwrap(body) || {};
  return {
    income: num(d.income),
    expense: num(d.expense),
    balance: num(d.balance ?? num(d.income) - num(d.expense)),
    count: num(d.count),
    byCategory: d.byCategory || {},
  };
}

export async function fetchBudgets(signal) {
  return (unwrap(await get('/budgets', { signal })) || []).map(normBudget);
}

export async function fetchGoals(signal) {
  return (unwrap(await get('/savings-goals', { signal })) || []).map(normGoal);
}

export const createTx = async (tx) => normTx(unwrap(await post('/transactions', tx)));
export const updateTx = async (id, tx) => normTx(unwrap(await put(`/transactions/${id}`, tx)));
export const deleteTx = (id) => del(`/transactions/${id}`);

export const createBudget = async (b) => normBudget(unwrap(await post('/budgets', b)));
export const updateBudget = async (id, limit) => normBudget(unwrap(await put(`/budgets/${id}`, { limit })));
export const deleteBudget = (id) => del(`/budgets/${id}`);

export const createGoal = async (g) => normGoal(unwrap(await post('/savings-goals', g)));
export const updateGoal = async (id, g) => normGoal(unwrap(await put(`/savings-goals/${id}`, g)));
export const patchGoal = async (id, g) => normGoal(unwrap(await patch(`/savings-goals/${id}`, g)));
export const deleteGoal = (id) => del(`/savings-goals/${id}`);

/** "expense:Food" -> [{ label: 'Food', value }], largest first. */
export function spendingByCategory(byCategory) {
  return Object.entries(byCategory || {})
    .filter(([k]) => k.startsWith('expense:'))
    .map(([k, v]) => ({ label: k.slice('expense:'.length) || 'Uncategorised', value: num(v) }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);
}
