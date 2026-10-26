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

const json = (body, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

/** Routes fetch calls to fixture data, the way the real API shapes them. */
export function mockApi(overrides = {}) {
  const f = { ...fixtures, ...overrides };
  return vi.spyOn(globalThis, 'fetch').mockImplementation((url, opts = {}) => {
    const u = new URL(url, 'http://localhost');
    const p = u.pathname;
    if (p === '/api/config') return json({}, 404);
    if (p === '/api/auth/me') return json({ success: true, data: f.me });
    if (p === '/api/transactions/stats/summary') return json({ success: true, data: f.summary });
    if (p === '/api/transactions' && (opts.method || 'GET') === 'GET') {
      return json({ success: true, data: f.transactions, pagination: { page: 1, limit: 20, total: f.transactions.length, totalPages: 1 } });
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
