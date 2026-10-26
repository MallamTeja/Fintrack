import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { mockApi, renderApp } from './helpers.jsx';
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
      Promise.resolve(new Response(JSON.stringify({ success: false, error: { message: 'Unauthorized' } }), { status: 401 }))
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
      expect.objectContaining({ amount: 1250.46, description: 'Electricity bill', category: 'Utilities', type: 'expense' })
    );
  });
});

describe('every screen renders with API data', () => {
  const screens = [
    ['/', /\w+ \d{4}/],
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
