// Pure aggregation helpers for the dashboard. No React, no fetching: rows in, numbers out.
// Rows are normalised transactions: { type: 'income' | 'expense', amount, category, date: 'YYYY-MM-DD' }.
import { isoDay, monthKey, parseDay } from './format.js';

export const PERIODS = [
  { id: 'month', label: 'This month', short: 'This month', months: 1 },
  { id: '3m', label: 'Last 3 months', short: '3 months', months: 3 },
  { id: '12m', label: 'Last 12 months', short: '12 months', months: 12 },
];

const DAY_MS = 86400000;
const shortMonth = new Intl.DateTimeFormat('en-IN', { month: 'short' });
const dayMonth = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });

const isExpense = (t) => t.type === 'expense';
const isIncome = (t) => t.type === 'income';
const sum = (rows) => rows.reduce((s, t) => s + (Number(t.amount) || 0), 0);

/** Whole calendar days from a to b, inclusive. Uses local midnight so DST cannot skew it. */
export function daysBetween(a, b) {
  const x = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const y = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((y - x) / DAY_MS) + 1;
}

export const daysInMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();

const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Same day n months away, clamped to the last day of the target month (31 Mar - 1 month = 28/29 Feb). */
function shiftMonths(d, n) {
  const first = new Date(d.getFullYear(), d.getMonth() + n, 1);
  return new Date(first.getFullYear(), first.getMonth(), Math.min(d.getDate(), daysInMonth(first)));
}

/**
 * The selected window and the equal window before it, both ending on a calendar day.
 * month: 1st of this month to today, against the same days of last month.
 * 3m / 12m: the trailing 3 or 12 months to today, against the 3 or 12 months before.
 */
export function periodWindows(periodId, today = new Date()) {
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let start;
  let prevStart;
  let prevEnd;
  if (periodId === 'month') {
    start = new Date(end.getFullYear(), end.getMonth(), 1);
    prevStart = shiftMonths(start, -1);
    prevEnd = shiftMonths(end, -1);
  } else {
    const n = periodId === '12m' ? 12 : 3;
    start = addDays(shiftMonths(end, -n), 1);
    prevEnd = addDays(start, -1);
    prevStart = addDays(shiftMonths(prevEnd, -n), 1);
  }
  const win = (s, e) => ({ start: s, end: e, startDate: isoDay(s), endDate: isoDay(e), days: daysBetween(s, e) });
  return { current: win(start, end), previous: win(prevStart, prevEnd) };
}

export const inWindow = (rows, w) => rows.filter((t) => t.date >= w.startDate && t.date <= w.endDate);

/** Totals for one window. savingsRate is null when there is no income, so the UI can say n/a instead of NaN. */
export function totals(rows, days = 1) {
  const income = sum(rows.filter(isIncome));
  const expense = sum(rows.filter(isExpense));
  const net = income - expense;
  return {
    income,
    expense,
    net,
    count: rows.length,
    savingsRate: income > 0 ? (net / income) * 100 : null,
    dailySpend: days > 0 ? expense / days : 0,
  };
}

/** Percent change from prev to cur. null when there is nothing to compare against. */
export function pctChange(cur, prev) {
  if (cur == null || prev == null || !Number.isFinite(cur) || !Number.isFinite(prev) || prev === 0) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

/**
 * The trailing n calendar months ending with today's month, oldest first,
 * each with income, expense and net.
 */
export function monthBuckets(rows, today = new Date(), n = 12) {
  const months = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const start = new Date(today.getFullYear(), today.getMonth() - i, 1);
    months.push({
      key: monthKey(isoDay(start)),
      start,
      label: shortMonth.format(start),
      year: start.getFullYear(),
      income: 0,
      expense: 0,
      net: 0,
      current: i === 0,
    });
  }
  const byKey = new Map(months.map((m) => [m.key, m]));
  rows.forEach((t) => {
    const m = byKey.get(monthKey(t.date));
    if (!m) return;
    if (isIncome(t)) m.income += t.amount;
    else if (isExpense(t)) m.expense += t.amount;
  });
  months.forEach((m) => {
    m.net = m.income - m.expense;
  });
  return months;
}

/** Sum by category for one type, largest first. */
export function byCategory(rows, type = 'expense') {
  const map = new Map();
  rows.forEach((t) => {
    if (t.type !== type) return;
    const k = (t.category || '').trim() || 'Uncategorised';
    map.set(k, (map.get(k) || 0) + t.amount);
  });
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

/** Keeps the n largest rows and folds the rest into one "Other" row. Adds share (0 to 100) to each. */
export function topN(rows, n = 6) {
  const total = rows.reduce((s, r) => s + r.value, 0);
  const head = rows.length > n + 1 ? rows.slice(0, n) : rows.slice();
  const rest = rows.length > n + 1 ? rows.slice(n) : [];
  if (rest.length) {
    head.push({ label: 'Other', value: rest.reduce((s, r) => s + r.value, 0), other: true, count: rest.length });
  }
  return head.map((r) => ({ ...r, share: total ? (r.value / total) * 100 : 0 }));
}

/**
 * Running spending total per day of month for this month and last month.
 * Days after today are null for this month so the line stops at today.
 */
export function cumulativePace(rows, today = new Date()) {
  const thisStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const len = Math.max(daysInMonth(thisStart), daysInMonth(lastStart));
  const perDay = (start) => {
    const arr = new Array(daysInMonth(start)).fill(0);
    const key = monthKey(isoDay(start));
    rows.forEach((t) => {
      if (isExpense(t) && monthKey(t.date) === key) arr[parseDay(t.date).getDate() - 1] += t.amount;
    });
    return arr;
  };
  const cur = perDay(thisStart);
  const prev = perDay(lastStart);
  const todayN = today.getDate();
  const days = [];
  let a = 0;
  let b = 0;
  for (let d = 1; d <= len; d += 1) {
    if (d <= cur.length) a += cur[d - 1];
    if (d <= prev.length) b += prev[d - 1];
    days.push({ day: d, current: d <= todayN && d <= cur.length ? a : null, previous: d <= prev.length ? b : null });
  }
  const sameDay = days[Math.min(todayN, prev.length) - 1]?.previous ?? 0;
  return {
    days,
    today: todayN,
    currentLabel: shortMonth.format(thisStart),
    previousLabel: shortMonth.format(lastStart),
    currentToDate: days[todayN - 1]?.current ?? 0,
    previousToDate: sameDay,
    previousTotal: b,
  };
}

/** Straight-line projection of month-end spending from the daily average so far. */
export function projectMonthEnd(spentToDate, today = new Date()) {
  const elapsed = today.getDate();
  const total = daysInMonth(today);
  const daily = elapsed > 0 ? spentToDate / elapsed : 0;
  return { daily, daysLeft: total - elapsed, projected: daily * total };
}

const quantile = (sorted, q) => {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
};

/**
 * Spending per day for the last `weeks` weeks, Monday-first columns ending with the current week.
 * Each day gets a level 0 to 4: 0 means nothing spent, 1 to 4 are quartiles of the days that had spending,
 * so a single rent day does not wash out every other day.
 */
export function dailyHeatmap(rows, today = new Date(), weeks = 12) {
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const mondayOffset = (end.getDay() + 6) % 7;
  const start = addDays(end, -mondayOffset - (weeks - 1) * 7);
  const totalsByDay = new Map();
  rows.forEach((t) => {
    if (isExpense(t)) totalsByDay.set(t.date, (totalsByDay.get(t.date) || 0) + t.amount);
  });
  const cells = [];
  for (let i = 0; i < weeks * 7; i += 1) {
    const d = addDays(start, i);
    const key = isoDay(d);
    cells.push({
      date: key,
      label: dayMonth.format(d),
      week: Math.floor(i / 7),
      weekday: i % 7,
      value: d > end ? null : totalsByDay.get(key) || 0,
    });
  }
  const spent = cells
    .filter((c) => c.value > 0)
    .map((c) => c.value)
    .sort((a, b) => a - b);
  const cuts = [0.25, 0.5, 0.75].map((q) => quantile(spent, q));
  cells.forEach((c) => {
    if (c.value == null) c.level = null;
    else if (c.value <= 0) c.level = 0;
    else c.level = 1 + cuts.filter((cut) => c.value > cut).length;
  });
  const active = cells.filter((c) => c.value != null);
  const max = active.reduce((m, c) => (c.value > (m?.value ?? 0) ? c : m), null);
  return {
    cells,
    weeks,
    cuts,
    max: max && max.value > 0 ? max : null,
    spendDays: spent.length,
    days: active.length,
    median: quantile(spent, 0.5),
  };
}

/** Months still available to save, counting the current one when the due date is later this month. */
export function goalPlan(goal, today = new Date()) {
  const left = Math.max(0, goal.target_amount - goal.current_amount);
  const pct = goal.target_amount > 0 ? Math.min(100, (goal.current_amount / goal.target_amount) * 100) : 0;
  if (left === 0) return { left, pct, state: 'done', months: 0, perMonth: 0 };
  if (!goal.due_date) return { left, pct, state: 'open', months: null, perMonth: null };
  const due = parseDay(goal.due_date);
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (due < t) return { left, pct, state: 'overdue', months: 0, perMonth: null };
  const months = Math.max(1, (due.getFullYear() - t.getFullYear()) * 12 + (due.getMonth() - t.getMonth()));
  return { left, pct, state: 'due', months, perMonth: left / months };
}

/** Budgets with percent used, most at risk first. */
export function budgetHealth(budgets) {
  return (budgets || [])
    .map((b) => {
      const pct = b.limit > 0 ? (b.current_spending / b.limit) * 100 : 0;
      return {
        ...b,
        pct,
        over: Math.max(0, b.current_spending - b.limit),
        state: pct > 100 ? 'over' : pct >= 80 ? 'near' : 'ok',
      };
    })
    .sort((a, b) => b.pct - a.pct || b.current_spending - a.current_spending);
}

/** Category with the largest absolute change in spending between two windows. */
export function biggestCategoryChange(curRows, prevRows) {
  const cur = new Map(byCategory(curRows).map((r) => [r.label, r.value]));
  const prev = new Map(byCategory(prevRows).map((r) => [r.label, r.value]));
  let best = null;
  new Set([...cur.keys(), ...prev.keys()]).forEach((label) => {
    const a = cur.get(label) || 0;
    const b = prev.get(label) || 0;
    const diff = a - b;
    if (diff !== 0 && (!best || Math.abs(diff) > Math.abs(best.diff)))
      best = { label, current: a, previous: b, diff, pct: pctChange(a, b) };
  });
  return best;
}

/** The single largest expense in a set of rows. */
export function largestExpense(rows) {
  return rows.filter(isExpense).reduce((m, t) => (!m || t.amount > m.amount ? t : m), null);
}
