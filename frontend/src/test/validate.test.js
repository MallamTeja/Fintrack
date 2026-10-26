import { describe, expect, it } from 'vitest';
import { formatDate, formatDay, formatMoney, setDateFormat } from '../lib/format.js';
import {
  fieldErrorsFrom,
  maxEntryDate,
  validateAmount,
  validateCategory,
  validateEntryDate,
  validateGoal,
  validateGoalMove,
  validateName,
  validateNotes,
  validateTransaction,
} from '../lib/validate.js';

const today = new Date(2026, 9, 26);

describe('shared validation rules', () => {
  it('limits amounts to more than 0, at most 1e9 and 2 decimals', () => {
    expect(validateAmount('')).toBe('Enter an amount.');
    expect(validateAmount('abc')).toMatch(/must be a number/);
    expect(validateAmount('0')).toBe('Amount must be more than zero.');
    expect(validateAmount('1000000000')).toBe('');
    expect(validateAmount('1000000000.01')).toMatch(/1,000,000,000 or less/);
    expect(validateAmount('12.345')).toMatch(/2 decimal places/);
    expect(validateAmount('1,250.50')).toBe('');
    expect(validateAmount('0', { allowZero: true, label: 'Saved so far' })).toBe('');
  });

  it('allows letters, numbers, spaces and & - / . , \' ( ) in categories', () => {
    expect(validateCategory('Food & Drinks')).toBe('');
    expect(validateCategory("Kids' school (fees) 2026/27, misc.")).toBe('');
    expect(validateCategory('Café')).toBe('');
    expect(validateCategory('Food <b>')).toMatch(/Use letters/);
    expect(validateCategory('x'.repeat(51))).toMatch(/50 characters/);
    expect(validateCategory('  ')).toBe('Enter a category.');
  });

  it('keeps dates between 1970 and tomorrow', () => {
    expect(maxEntryDate(today)).toBe('2026-10-27');
    expect(validateEntryDate('2026-10-27', { today })).toBe('');
    expect(validateEntryDate('2026-10-28', { today })).toMatch(/more than a day in the future/);
    expect(validateEntryDate('1969-12-31', { today })).toMatch(/before 1970/);
    expect(validateEntryDate('2026-02-30', { today })).toBe('Use a valid date.');
    expect(validateEntryDate('', { today })).toBe('');
  });

  it('treats description and notes as optional with length limits', () => {
    const base = { amount: '40', type: 'expense', category: 'Food', payment_method: 'cash' };
    expect(validateTransaction(base, { today })).toEqual({});
    expect(validateTransaction({ ...base, description: 'x'.repeat(201) }, { today })).toHaveProperty('description');
    expect(validateNotes('x'.repeat(501))).toMatch(/500/);
    expect(validateTransaction({ ...base, payment_method: 'cheque' }, { today })).toHaveProperty('payment_method');
  });

  it('checks names', () => {
    expect(validateName("Maya O'Neil-Rao Jr.")).toBe('');
    expect(validateName('Maya2')).toMatch(/letters/);
    expect(validateName('x'.repeat(61))).toMatch(/60/);
  });

  it('checks savings goals and money moves', () => {
    expect(validateGoal({ title: 'Trip', target: '1000', current: '10001', due: '' }, { today })).toHaveProperty('current');
    expect(validateGoal({ title: 'Trip', target: '1000', current: '10000', due: '' }, { today })).toEqual({});
    expect(validateGoal({ title: '', target: '1000', current: '', due: '2026-10-25' }, { today })).toMatchObject({
      title: 'Name the goal.',
      due: 'Choose today or a later date.',
    });
    expect(validateGoal({ title: 'Trip', target: '1000', current: '', due: '2026-10-25' }, { isNew: false, today })).toEqual({});
    const goal = { current_amount: 500, target_amount: 1000 };
    expect(validateGoalMove('600', goal, 'withdraw')).toMatch(/more than has been saved/);
    expect(validateGoalMove('500', goal, 'withdraw')).toBe('');
    expect(validateGoalMove('9600', goal, 'add')).toMatch(/10 times/);
  });

  it('maps API error details to form fields', () => {
    const err = { message: 'x', body: { error: { message: 'x', details: ['amount must be greater than 0', 'category must be 1-50 characters', 'Something else'] } } };
    expect(fieldErrorsFrom(err, ['amount', 'category'])).toEqual({
      amount: 'Amount must be greater than 0.',
      category: 'Category must be 1-50 characters.',
      _form: 'Something else',
    });
  });
});

describe('display preferences', () => {
  it('applies the chosen date format', () => {
    expect(formatDate('2026-10-05', 'DD/MM/YYYY')).toBe('05/10/2026');
    expect(formatDate('2026-10-05', 'MM/DD/YYYY')).toBe('10/05/2026');
    expect(formatDate('2026-10-05', 'YYYY-MM-DD')).toBe('2026-10-05');
    setDateFormat('MM/DD/YYYY');
    expect(formatDate('2026-10-05')).toBe('10/05/2026');
    expect(formatDay('2026-10-05')).toBe('Oct 05');
    setDateFormat('nonsense');
    expect(formatDay('2026-10-05')).toBe('05 Oct');
  });

  it('formats the added currencies', () => {
    expect(formatMoney(1234.5, 'JPY')).toBe('¥1,235');
    expect(formatMoney(1234.5, 'SGD')).toMatch(/1,234\.50/);
    expect(formatMoney(1234.5, 'AED')).toMatch(/1,234\.50/);
  });
});
