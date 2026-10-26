import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { fixtures, json, mockApi, renderApp } from './helpers.jsx';

const signedIn = () => localStorage.setItem('token', 'test-token');
const bodyOf = (spy, path, method) => {
  const call = spy.mock.calls.find(([u, o]) => String(u).startsWith(path) && (o?.method || 'GET') === method);
  return call ? JSON.parse(call[1].body) : undefined;
};

const CSV = `Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance
01/10/25,UPI-SWIGGY-SWIGGY@ICICI-ICIC0DC0099-412345678901-PAYMENT,0000412345678901,01/10/25,450.00,,"1,04,550.00"
02/10/25,NEFT CR-HDFC0000001-ACME TECHNOLOGIES PVT LTD-SALARY OCT,N123456789,02/10/25,,"85,000.00","1,89,550.00"
03/10/25,BESCOM BILL PAYMENT,000000000000,03/10/25,"1,299.00",,"1,88,251.00"
`;

describe('statement import', () => {
  it('reads a CSV in the browser, previews it and imports the chosen rows', async () => {
    signedIn();
    const spy = mockApi({}, (p, opts) => {
      if (p === '/api/transactions/import' && opts.method === 'POST') {
        const { rows } = JSON.parse(opts.body);
        return json({ success: true, data: { received: rows.length, inserted: rows.length - 1, duplicates: 1, invalid: [] } });
      }
      return undefined;
    });
    renderApp('/import');
    expect(await screen.findByRole('heading', { level: 1, name: 'Import' })).toBeInTheDocument();
    const file = new File([CSV], 'hdfc-october.csv', { type: 'text/csv' });
    fireEvent.change(screen.getByLabelText('Statement file'), { target: { files: [file] } });

    expect(await screen.findByRole('heading', { name: 'hdfc-october.csv' })).toBeInTheDocument();
    const table = screen.getByRole('table', { name: /Rows read from/ });
    expect(within(table).getByText('Swiggy')).toBeInTheDocument();
    expect(within(table).getByLabelText('Category for Swiggy')).toHaveValue('Food');
    expect(within(table).getByLabelText('Category for BESCOM BILL PAYMENT')).toHaveValue('Utilities');

    // Leave one row out and fix a category.
    fireEvent.click(within(table).getByLabelText('Include BESCOM BILL PAYMENT'));
    fireEvent.change(within(table).getByLabelText('Category for Swiggy'), { target: { value: 'Eating out' } });
    const go = screen.getByRole('button', { name: 'Import 2 rows' });
    fireEvent.click(go);

    expect(await screen.findByRole('heading', { name: 'Import finished' })).toBeInTheDocument();
    const sent = bodyOf(spy, '/api/transactions/import', 'POST');
    expect(sent.fileName).toBe('hdfc-october.csv');
    expect(sent.rows).toEqual([
      expect.objectContaining({ date: '2025-10-01', description: 'Swiggy', amount: 450, type: 'expense', category: 'Eating out', payment_method: 'upi' }),
      expect.objectContaining({ date: '2025-10-02', amount: 85000, type: 'income', category: 'Salary', payment_method: 'bank' }),
    ]);
    const added = screen.getByText('Added to the ledger').closest('div');
    expect(within(added).getByText('1')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View imported entries' })).toHaveAttribute('href', '/transactions?source=import');
  });

  it('rejects files that are not statements before reading them', async () => {
    signedIn();
    mockApi();
    renderApp('/import');
    await screen.findByRole('heading', { level: 1, name: 'Import' });
    fireEvent.change(screen.getByLabelText('Statement file'), { target: { files: [new File(['x'], 'photo.png')] } });
    expect(await screen.findByText('Choose a CSV, Excel (.xlsx) or PDF statement.')).toBeInTheDocument();
  });
});

describe('transactions page', () => {
  it('filters by search, method and source and marks imported rows', async () => {
    signedIn();
    const spy = mockApi({
      transactions: [{ ...fixtures.transactions[0], payment_method: 'bank', source: 'import' }],
    });
    renderApp('/transactions');
    expect(await screen.findByText('Imported')).toBeInTheDocument();
    expect(screen.getByText('Bank', { selector: '.ledger__method' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Paid by'), { target: { value: 'upi' } });
    fireEvent.change(screen.getByLabelText('Source'), { target: { value: 'import' } });
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'salary' } });
    await waitFor(() =>
      expect(spy.mock.calls.some(([u]) => /q=salary/.test(u) && /payment_method=upi/.test(u) && /source=import/.test(u))).toBe(true)
    );
    expect(screen.getByRole('link', { name: 'Import statement' })).toHaveAttribute('href', '/import');
  });
});

describe('settings', () => {
  it('saves the profile and preferences separately', async () => {
    signedIn();
    const spy = mockApi({}, (p, opts) => {
      if (p === '/api/auth/preferences' && opts.method === 'PUT') {
        return json({ success: true, preferences: JSON.parse(opts.body) });
      }
      return undefined;
    });
    renderApp('/settings');
    const name = await screen.findByLabelText('Name');
    expect(name).toHaveValue('Maya Okonkwo');
    fireEvent.change(name, { target: { value: 'Maya 2' } });
    fireEvent.blur(name);
    expect(await screen.findByText("Use letters, spaces and . ' - only.")).toBeInTheDocument();
    fireEvent.change(name, { target: { value: 'Maya Rao' } });
    expect(screen.queryByText("Use letters, spaces and . ' - only.")).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));
    expect(await screen.findByText('Profile saved.')).toBeInTheDocument();
    expect(bodyOf(spy, '/api/auth/preferences', 'PUT')).toEqual({ name: 'Maya Rao' });

    fireEvent.change(screen.getByLabelText('Date format'), { target: { value: 'YYYY-MM-DD' } });
    fireEvent.change(screen.getByLabelText('Month starts on day'), { target: { value: '25' } });
    fireEvent.change(screen.getByLabelText('Monthly income target (optional)'), { target: { value: '90000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save preferences' }));
    expect(await screen.findByText('Preferences saved.')).toBeInTheDocument();
    const puts = spy.mock.calls.filter(([u, o]) => String(u) === '/api/auth/preferences' && o?.method === 'PUT');
    expect(JSON.parse(puts[1][1].body)).toMatchObject({
      date_format: 'YYYY-MM-DD',
      month_start_day: 25,
      monthly_income_target: 90000,
      currency: 'INR',
      week_start: 'monday',
    });
  });

  it('blocks a weak new password, reports a wrong current one and confirms a change', async () => {
    signedIn();
    let attempts = 0;
    const spy = mockApi({}, (p, opts) => {
      if (p === '/api/auth/password') {
        attempts += 1;
        return attempts === 1
          ? json({ success: false, error: { message: 'Current password is incorrect' } }, 401)
          : json({ success: true, message: 'Password updated' });
      }
      return undefined;
    });
    renderApp('/settings');
    const form = await screen.findByRole('form', { name: 'Change password' });
    const f = within(form);
    fireEvent.change(f.getByLabelText('Current password'), { target: { value: 'OldPass1' } });
    fireEvent.change(f.getByLabelText('New password'), { target: { value: 'weak' } });
    fireEvent.click(f.getByRole('button', { name: 'Change password' }));
    expect(await f.findByText('The new password needs every item on the list.')).toBeInTheDocument();
    expect(attempts).toBe(0);

    fireEvent.change(f.getByLabelText('New password'), { target: { value: 'Ledger2026' } });
    expect(within(f.getByRole('list', { name: 'Password requirements' })).getByText('A number').closest('li')).toHaveClass('is-met');
    fireEvent.change(f.getByLabelText('Confirm new password'), { target: { value: 'Ledger2026' } });
    fireEvent.click(f.getByRole('button', { name: 'Change password' }));
    expect(await f.findByText('That is not your current password.')).toBeInTheDocument();
    expect(localStorage.getItem('token')).toBe('test-token');

    fireEvent.change(f.getByLabelText('Current password'), { target: { value: 'RightPass1' } });
    fireEvent.click(f.getByRole('button', { name: 'Change password' }));
    expect(await f.findByText(/Password changed/)).toBeInTheDocument();
    expect(bodyOf(spy, '/api/auth/password', 'POST')).toEqual({ currentPassword: 'OldPass1', newPassword: 'Ledger2026' });
  });

  it('deletes the account only after DELETE is typed, then signs out', async () => {
    signedIn();
    const spy = mockApi({}, (p, opts) => {
      if (p === '/api/auth/account' && opts.method === 'DELETE') return json({ success: true });
      return undefined;
    });
    renderApp('/settings');
    fireEvent.click(await screen.findByRole('button', { name: 'Delete account' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Delete your account?' });
    const d = within(dialog);
    fireEvent.click(d.getByRole('button', { name: 'Delete account' }));
    expect(await d.findByText('Type DELETE in capital letters to confirm.')).toBeInTheDocument();
    expect(spy.mock.calls.some(([u]) => String(u) === '/api/auth/account')).toBe(false);

    fireEvent.change(d.getByLabelText('Type DELETE to confirm'), { target: { value: 'DELETE' } });
    fireEvent.click(d.getByRole('button', { name: 'Delete account' }));
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(bodyOf(spy, '/api/auth/account', 'DELETE')).toEqual({ confirm: 'DELETE' });
    expect(localStorage.getItem('token')).toBeNull();
  });
});

describe('savings and budgets', () => {
  it('withdraws from a goal with validation', async () => {
    signedIn();
    const spy = mockApi({}, (p, opts) => {
      if (p === '/api/savings-goals/g1' && opts.method === 'PATCH') return json({ ...fixtures.goals[0], ...JSON.parse(opts.body) });
      return undefined;
    });
    renderApp('/savings');
    fireEvent.click(await screen.findByRole('button', { name: 'Withdraw' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Withdraw' });
    const amount = within(dialog).getByLabelText(/Amount to take from/);
    fireEvent.change(amount, { target: { value: '70000' } });
    fireEvent.blur(amount);
    expect(await within(dialog).findByText('You cannot withdraw more than has been saved.')).toBeInTheDocument();
    fireEvent.change(amount, { target: { value: '4000' } });
    expect(within(dialog).queryByText('You cannot withdraw more than has been saved.')).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Withdraw' }));
    await waitFor(() => expect(bodyOf(spy, '/api/savings-goals/g1', 'PATCH')).toEqual({ current_amount: 60000 }));
  });

  it('shows what is left of each budget and the days left in the month', async () => {
    signedIn();
    mockApi();
    renderApp('/budgets');
    expect(await screen.findByText(/remaining ·/)).toBeInTheDocument();
    expect(screen.getByText(/(days? left in|Last day of) /)).toBeInTheDocument();
  });
});
