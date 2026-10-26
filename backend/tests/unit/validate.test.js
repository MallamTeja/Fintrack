const v = require('../../src/validate');

const tx = (over = {}) => ({ description: 'Rent', amount: 1000, type: 'expense', category: 'Housing', ...over });

describe('parseTransaction', () => {
    test('accepts a valid transaction and keeps only known fields', () => {
        const out = v.parseTransaction({ ...tx(), user_id: 'someone-else', id: 'x', extra: 1 });
        expect(out).toEqual({ description: 'Rent', amount: 1000, type: 'expense', category: 'Housing' });
    });

    test('normalises numbers, dates and whitespace', () => {
        const out = v.parseTransaction(tx({ amount: '12.345', category: '  Food ', date: '2026-01-02' }));
        expect(out.amount).toBe(12.35);
        expect(out.category).toBe('Food');
        expect(out.date).toBe('2026-01-02T00:00:00.000Z');
    });

    test.each([
        ['negative amount', { amount: -1 }],
        ['zero amount', { amount: 0 }],
        ['text amount', { amount: 'abc' }],
        ['huge amount', { amount: 1e12 }],
        ['bad type', { type: 'gift' }],
        ['empty description', { description: '   ' }],
        ['long category', { category: 'x'.repeat(51) }],
        ['bad date', { date: 'yesterday' }],
        ['object injection', { category: { $ne: null } }],
    ])('rejects %s', (_, over) => {
        expect(() => v.parseTransaction(tx(over))).toThrow(expect.objectContaining({ status: 400 }));
    });

    test('requires all fields on create but not on partial update', () => {
        expect(() => v.parseTransaction({})).toThrow(/required/);
        expect(v.parseTransaction({ amount: 5 }, true)).toEqual({ amount: 5 });
        expect(() => v.parseTransaction({}, true)).toThrow(/Nothing to update/);
    });

    test('rejects non-object bodies', () => {
        expect(() => v.parseTransaction([tx()])).toThrow(/JSON object/);
        expect(() => v.parseTransaction(null)).toThrow(/JSON object/);
    });
});

describe('parseBudget / parseSavingsGoal', () => {
    test('budget maps limit to limit_amount', () => {
        expect(v.parseBudget({ category: 'Food', limit: '500' })).toEqual({ category: 'Food', limit_amount: 500 });
        expect(v.parseBudget({ limit: 10, category: 'ignored on update' }, true)).toEqual({ limit_amount: 10 });
        expect(() => v.parseBudget({ category: 'Food', limit: 0 })).toThrow();
    });

    test('savings goal validates amounts and date', () => {
        expect(v.parseSavingsGoal({ title: 'Laptop', target_amount: 80000, due_date: '2027-06-01T10:00:00Z' })).toEqual({
            title: 'Laptop',
            target_amount: 80000,
            due_date: '2027-06-01',
        });
        expect(v.parseSavingsGoal({ current_amount: 0 }, true)).toEqual({ current_amount: 0 });
        expect(() => v.parseSavingsGoal({ title: 'x', target_amount: 10, due_date: 'soon' })).toThrow();
    });
});

describe('parseCredentials', () => {
    test('register needs a strong password and a name', () => {
        expect(v.parseCredentials({ name: 'Teja', email: ' A@B.co ', password: 'Passw0rd' }, { withName: true })).toEqual({
            name: 'Teja',
            email: 'a@b.co',
            password: 'Passw0rd',
        });
        for (const password of ['short1A', 'alllowercase1', 'ALLUPPER1', 'NoDigitsHere']) {
            expect(() => v.parseCredentials({ name: 'x', email: 'a@b.co', password }, { withName: true })).toThrow();
        }
    });

    test('login rejects non-string or malformed input', () => {
        expect(() => v.parseCredentials({ email: { $ne: null }, password: 'x' })).toThrow();
        expect(() => v.parseCredentials({ email: 'not-an-email', password: 'x' })).toThrow();
        expect(() => v.parseCredentials({ email: 'a@b.co' })).toThrow();
    });
});

test('isUuid', () => {
    expect(v.isUuid('3f1c2a4e-8b6d-4c2a-9e1f-0a1b2c3d4e5f')).toBe(true);
    for (const bad of ['1', '507f1f77bcf86cd799439011', '../etc', null, 42]) expect(v.isUuid(bad)).toBe(false);
});

test('parsePreferences', () => {
    expect(v.parsePreferences({ theme: 'dark', currency: 'INR', notifications: false })).toEqual({
        theme: 'dark',
        currency: 'INR',
        notifications: false,
    });
    expect(() => v.parsePreferences({ theme: 'neon' })).toThrow();
    expect(() => v.parsePreferences({})).toThrow();
});
