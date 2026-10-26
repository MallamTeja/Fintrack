import { describe, expect, it } from 'vitest';
import { formatMoney, moneyParts, toDay } from '../lib/format.js';
import { passwordChecks, validateTransaction } from '../lib/validate.js';

describe('formatMoney', () => {
  it('uses Indian digit grouping for INR', () => {
    expect(formatMoney(123456)).toBe('₹1,23,456.00');
    expect(formatMoney(12345678.9, 'INR')).toBe('₹1,23,45,678.90');
  });

  it('formats other currencies with their own conventions', () => {
    expect(formatMoney(1234.5, 'USD')).toBe('$1,234.50');
    expect(formatMoney(1234.5, 'GBP')).toBe('£1,234.50');
  });

  it('uses a true minus sign for negatives and falls back to INR for unknown codes', () => {
    expect(formatMoney(-500)).toBe('−₹500.00');
    expect(formatMoney(10, 'XYZ')).toBe('₹10.00');
  });

  it('splits symbol, figure and decimals so they can be styled apart', () => {
    expect(moneyParts(123456.78)).toMatchObject({ symbol: '₹', whole: '1,23,456', fraction: '.78', sign: '' });
  });
});

describe('dates', () => {
  it('reads the calendar day without timezone drift', () => {
    expect(toDay('2026-03-01T00:00:00.000Z')).toBe('2026-03-01');
  });
});

describe('validation rules', () => {
  it('checks every password rule', () => {
    const ok = (p) => passwordChecks(p).every((c) => c.ok);
    expect(ok('short1A')).toBe(false);
    expect(ok('alllowercase1')).toBe(false);
    expect(ok('NoDigitsHere')).toBe(false);
    expect(ok('Ledger2026')).toBe(true);
    expect(ok(`A1${'a'.repeat(71)}`)).toBe(false);
  });

  it('mirrors the API limits for transactions', () => {
    const base = { description: 'Tea', amount: '40', type: 'expense', category: 'Food' };
    expect(validateTransaction(base)).toEqual({});
    expect(validateTransaction({ ...base, amount: '0' })).toHaveProperty('amount');
    expect(validateTransaction({ ...base, amount: '1000000001' })).toHaveProperty('amount');
    expect(validateTransaction({ ...base, description: 'x'.repeat(201) })).toHaveProperty('description');
    expect(validateTransaction({ ...base, category: '' })).toHaveProperty('category');
  });
});
