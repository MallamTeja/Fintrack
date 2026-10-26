import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { fixtures, mockApi, renderApp } from './helpers.jsx';
import { fetchAllTransactions } from '../lib/data.js';
import TransactionForm from '../pages/TransactionForm.jsx';

describe('auth redirect', () => {
  it('sends a signed-out visitor to the sign-in page', async () => {
    renderApp('/transactions');
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('lets a signed-in user reach a protected page', async () => {
    localStorage.setItem('token', 'test-token');
    mockApi();
    renderApp('/transactions');
    expect(await screen.findByRole('heading', { name: 'Transactions', level: 1 })).toBeInTheDocument();
  });

  it('clears the session and returns to sign in when the API rejects the token', async () => {
    localStorage.setItem('token', 'expired');
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ success: false, error: { message: 'Unauthorized' } }), { status: 401 })
      )
    );
    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(localStorage.getItem('token')).toBeNull();
  });
});

describe('register form', () => {
  it('shows a live password checklist and blocks a weak password', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    renderApp('/register');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Sam Tan' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'sam@example.in' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'ledger' } });
    const rules = screen.getByRole('list', { name: 'Password requirements' });
    expect(within(rules).getByText('A lowercase letter').closest('li')).toHaveClass('is-met');
    expect(within(rules).getByText('A number').closest('li')).not.toHaveClass('is-met');
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('The password needs every item on the list.')).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('transaction form validation', () => {
  it('reports every invalid field and does not submit', () => {
    const onSubmit = vi.fn();
    render(<TransactionForm onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '-5' } });
    fireEvent.submit(screen.getByLabelText('Amount').closest('form'));
    expect(screen.getByText('Amount must be more than zero.')).toBeInTheDocument();
    expect(screen.getByText('Describe the entry.')).toBeInTheDocument();
    expect(screen.getByText('Enter a category.')).toBeInTheDocument();
    expect(screen.getByLabelText('Amount')).toHaveAttribute('aria-invalid', 'true');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits a clean payload when valid', () => {
    const onSubmit = vi.fn();
    render(<TransactionForm onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '1,250.456' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: '  Electricity bill ' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Utilities' } });
    fireEvent.submit(screen.getByLabelText('Amount').closest('form'));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 1250.46,
        description: 'Electricity bill',
        category: 'Utilities',
        type: 'expense',
      })
    );
  });
});

describe('every screen renders with API data', () => {
  const screens = [
    ['/', 'Dashboard'],
    ['/dashboard', 'Dashboard'],
    ['/transactions', 'Transactions'],
    ['/budgets', 'Budgets'],
    ['/savings', 'Savings'],
    ['/settings', 'Settings'],
  ];
  it.each(screens)('%s', async (path, heading) => {
    localStorage.setItem('token', 'test-token');
    mockApi();
    renderApp(path);
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryAllByText(/Not mocked/)).toHaveLength(0));
  });

  it('shows ledger rows and budget warnings', async () => {
    localStorage.setItem('token', 'test-token');
    mockApi();
    renderApp('/budgets');
    expect(await screen.findByText('89% used')).toBeInTheDocument();
  });

  it('renders a 404 for unknown paths', () => {
    renderApp('/nowhere');
    expect(screen.getByRole('heading', { name: 'This page is not in the ledger.' })).toBeInTheDocument();
  });
});

describe('dashboard', () => {
  const todayIso = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  it('labels the nav item Dashboard and renders figures, charts and lists from the API', async () => {
    localStorage.setItem('token', 'test-token');
    mockApi();
    renderApp('/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Dashboard/ })[0]).toHaveAttribute('aria-current', 'page');
    expect(await screen.findByText('Flat rent')).toBeInTheDocument();
    for (const name of [
      'Cash flow',
      'Where it went',
      'Spending pace',
      'Daily spending',
      'Where it came from',
      'Budget health',
      'Savings goals',
      'Insights',
      'Recent entries',
    ]) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument();
    }
    for (const label of ['Income', 'Spending', 'Net saved', 'Savings rate', 'Average daily spend', 'Entries']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.getByRole('table', { name: 'Income, spending and net by month' })).toBeInTheDocument();
    expect(screen.getByText('89% used')).toBeInTheDocument();
    expect(screen.getByText(/a month/)).toBeInTheDocument();
    expect(screen.queryByText('NaN', { exact: false })).toBeNull();
  });

  it('switches the period with the segmented control', async () => {
    localStorage.setItem('token', 'test-token');
    const spy = mockApi();
    renderApp('/');
    const year = await screen.findByRole('radio', { name: 'Last 12 months' });
    expect(screen.getByRole('radio', { name: 'This month' })).toBeChecked();
    fireEvent.click(year);
    expect(year).toBeChecked();
    await waitFor(() =>
      expect(
        spy.mock.calls.some(([u]) => String(u).includes('limit=500') && /startDate=\d{4}-\d{2}-01/.test(String(u)))
      ).toBe(true)
    );
    expect(await screen.findAllByText('Last 12 months')).not.toHaveLength(0);
  });

  it('shows n/a for the savings rate when there is no income', async () => {
    localStorage.setItem('token', 'test-token');
    mockApi({
      transactions: [{ id: 'x', type: 'expense', category: 'Food', amount: 500, description: 'Lunch', date: todayIso }],
    });
    renderApp('/');
    expect(await screen.findByText('n/a')).toBeInTheDocument();
    expect(screen.getByText('No income this period')).toBeInTheDocument();
  });

  it('shows a clear first step for a brand-new user', async () => {
    localStorage.setItem('token', 'test-token');
    mockApi({ transactions: [], budgets: [], goals: [] });
    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Your ledger is empty' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add your first entry' })).toHaveAttribute('href', '/transactions?new=1');
    expect(screen.queryByRole('heading', { name: 'Cash flow' })).toBeNull();
  });

  it('offers a retry when transactions fail to load', async () => {
    localStorage.setItem('token', 'test-token');
    const base = mockApi();
    const real = base.getMockImplementation();
    base.mockImplementation((url, opts) =>
      String(url).includes('limit=500')
        ? Promise.resolve(
            new Response(JSON.stringify({ success: false, error: { message: 'The server had a problem.' } }), {
              status: 500,
            })
          )
        : real(url, opts)
    );
    renderApp('/');
    expect(await screen.findByText('The server had a problem.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Try again' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Budget health' })).toBeInTheDocument();
  });

  it('pages through every transaction page up to the cap', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      const page = Number(new URL(url, 'http://localhost').searchParams.get('page'));
      return Promise.resolve(
        new Response(
          JSON.stringify({
            success: true,
            data: [{ ...fixtures.transactions[0], id: `p${page}` }],
            pagination: { page, limit: 500, total: 3, totalPages: 3 },
          }),
          { status: 200 }
        )
      );
    });
    const out = await fetchAllTransactions({ startDate: '2026-01-01', endDate: '2026-12-31' });
    expect(out.rows.map((r) => r.id)).toEqual(['p1', 'p2', 'p3']);
    expect(out.truncated).toBe(false);
    expect(spy).toHaveBeenCalledTimes(3);
    const capped = await fetchAllTransactions({ startDate: '2026-01-01', endDate: '2026-12-31', maxPages: 2 });
    expect(capped).toMatchObject({ truncated: true });
    expect(capped.rows).toHaveLength(2);
  });
});
