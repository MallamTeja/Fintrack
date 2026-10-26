import { describe, expect, it } from 'vitest';
import {
  biggestCategoryChange,
  budgetHealth,
  byCategory,
  cumulativePace,
  dailyHeatmap,
  goalPlan,
  inWindow,
  largestExpense,
  monthBuckets,
  pctChange,
  periodWindows,
  projectMonthEnd,
  topN,
  totals,
} from '../lib/analytics.js';

const today = new Date(2026, 9, 26); // 26 Oct 2026, a Monday
const tx = (date, type, category, amount, description = category) => ({ date, type, category, amount, description });

describe('periodWindows', () => {
  it('compares month to date with the same days of last month', () => {
    const { current, previous } = periodWindows('month', today);
    expect([current.startDate, current.endDate, current.days]).toEqual(['2026-10-01', '2026-10-26', 26]);
    expect([previous.startDate, previous.endDate, previous.days]).toEqual(['2026-09-01', '2026-09-26', 26]);
  });

  it('clamps the comparison day to a shorter month', () => {
    const { previous } = periodWindows('month', new Date(2026, 2, 31));
    expect([previous.startDate, previous.endDate]).toEqual(['2026-02-01', '2026-02-28']);
  });

  it('uses back-to-back trailing windows for 3 and 12 months', () => {
    const q = periodWindows('3m', today);
    expect([q.current.startDate, q.current.endDate]).toEqual(['2026-07-27', '2026-10-26']);
    expect([q.previous.startDate, q.previous.endDate]).toEqual(['2026-04-27', '2026-07-26']);
    const y = periodWindows('12m', today);
    expect([y.current.startDate, y.previous.endDate, y.previous.startDate]).toEqual([
      '2025-10-27',
      '2025-10-26',
      '2024-10-27',
    ]);
  });
});

describe('totals and deltas', () => {
  it('sums income and spending and works out the savings rate', () => {
    const t = totals([tx('2026-10-01', 'income', 'Salary', 100000), tx('2026-10-03', 'expense', 'Rent', 25000)], 25);
    expect(t).toMatchObject({
      income: 100000,
      expense: 25000,
      net: 75000,
      count: 2,
      savingsRate: 75,
      dailySpend: 1000,
    });
  });

  it('returns null, not NaN, for the savings rate when there is no income', () => {
    const t = totals([tx('2026-10-03', 'expense', 'Rent', 25000)], 3);
    expect(t.savingsRate).toBeNull();
    expect(totals([], 0)).toMatchObject({ income: 0, expense: 0, savingsRate: null, dailySpend: 0 });
  });

  it('gives a percent change, or null when the previous value is zero', () => {
    expect(pctChange(120, 100)).toBe(20);
    expect(pctChange(80, 100)).toBe(-20);
    expect(pctChange(-50, -100)).toBe(50);
    expect(pctChange(10, 0)).toBeNull();
    expect(pctChange(null, 10)).toBeNull();
  });
});

describe('monthBuckets', () => {
  it('returns 12 months oldest first and drops rows outside them', () => {
    const rows = [
      tx('2026-10-02', 'income', 'Salary', 90000),
      tx('2026-10-05', 'expense', 'Rent', 26000),
      tx('2025-11-15', 'expense', 'Food', 500),
      tx('2025-10-31', 'expense', 'Food', 999),
    ];
    const m = monthBuckets(rows, today, 12);
    expect(m).toHaveLength(12);
    expect(m[0]).toMatchObject({ key: '2025-11', expense: 500, net: -500 });
    expect(m[11]).toMatchObject({ key: '2026-10', income: 90000, expense: 26000, net: 64000, current: true });
    expect(m.reduce((s, x) => s + x.expense, 0)).toBe(26500);
  });
});

describe('categories', () => {
  it('ranks categories and folds the tail into Other', () => {
    const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((c, i) => tx('2026-10-01', 'expense', c, 800 - i * 100));
    rows.push(tx('2026-10-02', 'income', 'Salary', 5000));
    const top = topN(byCategory(rows), 6);
    expect(top.map((r) => r.label)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'Other']);
    expect(top[6]).toMatchObject({ value: 300, other: true, count: 2 });
    expect(top.reduce((s, r) => s + r.share, 0)).toBeCloseTo(100);
  });

  it('does not make an Other row for a single leftover category', () => {
    const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((c) => tx('2026-10-01', 'expense', c, 10));
    expect(topN(byCategory(rows), 6).some((r) => r.other)).toBe(false);
  });

  it('finds the biggest change between periods', () => {
    const cur = [tx('2026-10-02', 'expense', 'Food', 3000), tx('2026-10-02', 'expense', 'Rent', 26000)];
    const prev = [
      tx('2026-09-02', 'expense', 'Food', 1000),
      tx('2026-09-02', 'expense', 'Rent', 26000),
      tx('2026-09-02', 'expense', 'Gym', 1500),
    ];
    expect(biggestCategoryChange(cur, prev)).toMatchObject({ label: 'Food', diff: 2000, pct: 200 });
    expect(largestExpense(cur)).toMatchObject({ category: 'Rent', amount: 26000 });
    expect(inWindow(prev, periodWindows('month', today).previous)).toHaveLength(3);
  });
});

describe('pace', () => {
  const rows = [
    tx('2026-10-01', 'expense', 'Rent', 26000),
    tx('2026-10-20', 'expense', 'Food', 2000),
    tx('2026-09-01', 'expense', 'Rent', 26000),
    tx('2026-09-30', 'expense', 'Food', 4000),
  ];

  it('builds running totals that stop at today for this month', () => {
    const p = cumulativePace(rows, today);
    expect(p.days).toHaveLength(31);
    expect(p.days[0]).toEqual({ day: 1, current: 26000, previous: 26000 });
    expect(p.days[25].current).toBe(28000);
    expect(p.days[26].current).toBeNull();
    expect(p.days[30].previous).toBeNull();
    expect([p.currentToDate, p.previousToDate, p.previousTotal]).toEqual([28000, 26000, 30000]);
  });

  it('projects month-end spending from the daily average', () => {
    expect(projectMonthEnd(26000, today)).toEqual({ daily: 1000, daysLeft: 5, projected: 31000 });
  });
});

describe('dailyHeatmap', () => {
  it('lays out 12 Monday-first weeks ending this week with quartile levels', () => {
    const rows = [
      tx('2026-10-26', 'expense', 'Food', 100),
      tx('2026-10-25', 'expense', 'Food', 400),
      tx('2026-10-24', 'expense', 'Rent', 26000),
    ];
    const h = dailyHeatmap(rows, today, 12);
    expect(h.cells).toHaveLength(84);
    expect(h.cells[0].date).toBe('2026-08-10');
    expect(h.cells[0].weekday).toBe(0);
    const byDate = Object.fromEntries(h.cells.map((c) => [c.date, c]));
    expect(byDate['2026-10-27'].level).toBeNull();
    expect(byDate['2026-10-23'].level).toBe(0);
    expect(byDate['2026-10-26'].level).toBe(1);
    expect(byDate['2026-10-24'].level).toBe(4);
    expect(h.max).toMatchObject({ date: '2026-10-24', value: 26000 });
    expect(h.spendDays).toBe(3);
  });
});

describe('goals and budgets', () => {
  it('works out the monthly saving needed to hit a due date', () => {
    const g = { target_amount: 300000, current_amount: 180000, due_date: '2027-03-31' };
    expect(goalPlan(g, today)).toMatchObject({ left: 120000, state: 'due', months: 5, perMonth: 24000 });
    expect(goalPlan({ ...g, due_date: '2026-10-30' }, today)).toMatchObject({ months: 1, perMonth: 120000 });
    expect(goalPlan({ ...g, due_date: '' }, today)).toMatchObject({ state: 'open', perMonth: null });
    expect(goalPlan({ ...g, due_date: '2026-01-01' }, today).state).toBe('overdue');
    expect(goalPlan({ ...g, current_amount: 300000 }, today)).toMatchObject({ state: 'done', left: 0, pct: 100 });
  });

  it('sorts budgets most at risk first with the 80% and over-limit states', () => {
    const h = budgetHealth([
      { id: 'a', category: 'Food', limit: 1000, current_spending: 500 },
      { id: 'b', category: 'Fun', limit: 1000, current_spending: 1200 },
      { id: 'c', category: 'Fuel', limit: 1000, current_spending: 850 },
    ]);
    expect(h.map((b) => [b.id, b.state])).toEqual([
      ['b', 'over'],
      ['c', 'near'],
      ['a', 'ok'],
    ]);
    expect(h[0].over).toBe(200);
  });
});
