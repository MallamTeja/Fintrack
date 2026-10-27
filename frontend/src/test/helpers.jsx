import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import App from '../App.jsx';

const iso = (d) => d.toISOString().slice(0, 10);
const today = new Date();
const daysAgo = (n) => iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() - n));

export const fixtures = {
  me: { id: 'u1', email: 'maya@example.in', name: 'Maya Okonkwo', preferences: { theme: 'light', currency: 'INR', notifications: true } },
  transactions: [
    { id: 't1', type: 'income', category: 'Salary', amount: 85000, description: 'October salary', date: daysAgo(1) },
    { id: 't2', type: 'expense', category: 'Rent', amount: 24000, description: 'Flat rent', date: daysAgo(2) },
    { id: 't3', type: 'expense', category: 'Groceries', amount: 3120.5, description: 'Weekly vegetables', date: daysAgo(3) },
  ],
  summary: { income: 85000, expense: 27120.5, balance: 57879.5, count: 3, byCategory: { 'income:Salary': 85000, 'expense:Rent': 24000, 'expense:Groceries': 3120.5 } },
  budgets: [{ id: 'b1', category: 'Groceries', limit: 3500, current_spending: 3120.5 }],
  goals: [{ id: 'g1', title: 'Emergency fund', target_amount: 200000, current_amount: 64000, category: 'Safety', due_date: '2027-06-30' }],
};

export const json = (body, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

/** Routes fetch calls to fixture data, the way the real API shapes them. */
export const PAYEES = [
  { key: 'upi:9866352390-2', name: 'Pullaiah', named: false, upi_id: '9866352390-2@ybl', count: 2, received: 6500, paid: 0, first_date: '2026-09-05T00:00:00Z', last_date: '2026-09-18T00:00:00Z' },
  { key: 'name:swiggy', name: 'Swiggy', named: false, upi_id: '', count: 3, received: 146, paid: 219, first_date: '2026-09-23T00:00:00Z', last_date: '2026-09-29T00:00:00Z' },
];

export function mockApi(overrides = {}, handle) {
  const f = { ...fixtures, ...overrides };
  return vi.spyOn(globalThis, 'fetch').mockImplementation((url, opts = {}) => {
    const u = new URL(url, 'http://localhost');
    const p = u.pathname;
    const custom = handle?.(p, opts, u);
    if (custom) return custom;
    if (p === '/api/transactions/categories') {
      return json({ success: true, data: [{ category: 'Groceries', type: 'expense', count: 4 }, { category: 'Salary', type: 'income', count: 1 }] });
    }
    if (p === '/api/config') return json({}, 404);
    if (p === '/api/auth/me') return json({ success: true, data: f.me });
    if (p === '/api/transactions/stats/summary') return json({ success: true, data: f.summary });
    if (p === '/api/transactions' && (opts.method || 'GET') === 'GET') {
      return json({ success: true, data: f.transactions, pagination: { page: 1, limit: 20, total: f.transactions.length, totalPages: 1 } });
    }
    if (p === '/api/payees') return json({ success: true, data: f.payees || PAYEES });
    if (p === '/api/payees/detail') {
      const key = u.searchParams.get('key');
      const payee = (f.payees || PAYEES).find((x) => x.key === key);
      if (!payee) return json({ success: false, error: { message: 'No transactions for this payee' } }, 404);
      const tx = { id: 'p1', _id: 'p1', type: 'income', amount: 5500, description: payee.name, category: 'Other income', notes: 'UPIAB/1/CR/PULLAIA H/SBIN/9866352390-2@ybl', payee_key: key, source: 'import', payment_method: 'upi', date: '2026-09-05T00:00:00Z' };
      return json({ success: true, data: { payee, transactions: [tx] } });
    }
    if (p === '/api/budgets') return json(f.budgets);
    if (p === '/api/savings-goals') return json(f.goals);
    return json({ success: false, error: { message: 'Not mocked' } }, 404);
  });
}

export function renderApp(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </MemoryRouter>
  );
}
