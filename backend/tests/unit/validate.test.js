const v = require('../../src/validate');

const tx = (over = {}) => ({ description: 'Rent', amount: 1000, type: 'expense', category: 'Housing', ...over });
const DAY = 24 * 60 * 60 * 1000;
const isoDay = (offsetDays) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);
const rejects = (fn, re) => expect(fn).toThrow(expect.objectContaining({ status: 400, ...(re ? { message: expect.stringMatching(re) } : {}) }));

describe('parseTransaction', () => {
    test('accepts a valid transaction and keeps only known fields', () => {
        const out = v.parseTransaction({ ...tx(), user_id: 'someone-else', id: 'x', extra: 1, source: 'import', import_hash: 'f'.repeat(64) });
        expect(out).toEqual({ description: 'Rent', amount: 1000, type: 'expense', category: 'Housing' });
    });

    test('normalises numbers, dates and whitespace', () => {
        const out = v.parseTransaction(tx({ amount: '12.34', category: '  Food ', date: '2026-01-02' }));
        expect(out.amount).toBe(12.34);
        expect(out.category).toBe('Food');
        expect(out.date).toBe('2026-01-02T00:00:00.000Z');
    });

    test('description is optional, may be empty and is trimmed', () => {
        expect(v.parseTransaction(tx({ description: undefined }))).not.toHaveProperty('description');
        expect(v.parseTransaction(tx({ description: '' })).description).toBe('');
        expect(v.parseTransaction(tx({ description: '  Lunch  ' })).description).toBe('Lunch');
        expect(v.parseTransaction(tx({ description: 'x'.repeat(200) })).description).toHaveLength(200);
        rejects(() => v.parseTransaction(tx({ description: 'x'.repeat(201) })), /description must be at most 200/);
        expect(v.parseTransaction({ description: '' }, true)).toEqual({ description: '' }); // clear on PATCH
    });

    test('notes and payment_method', () => {
        const out = v.parseTransaction(tx({ notes: ' line 1\r\nline 2 ', payment_method: 'upi' }));
        expect(out).toMatchObject({ notes: 'line 1\nline 2', payment_method: 'upi' });
        expect(v.parseTransaction(tx({ notes: 'n'.repeat(500) })).notes).toHaveLength(500);
        rejects(() => v.parseTransaction(tx({ notes: 'n'.repeat(501) })), /notes must be at most 500/);
        for (const m of ['upi', 'card', 'cash', 'bank', 'wallet', 'other']) {
            expect(v.parseTransaction(tx({ payment_method: m })).payment_method).toBe(m);
        }
        rejects(() => v.parseTransaction(tx({ payment_method: 'cheque' })), /payment_method must be one of/);
        rejects(() => v.parseTransaction(tx({ payment_method: ['upi'] })));
    });

    test('strips control characters from text', () => {
        const out = v.parseTransaction(tx({ description: 'Te\u0000a\u001b\u007f\u0085', notes: 'a\tb\u0007\nc' }));
        expect(out.description).toBe('Tea');
        expect(out.notes).toBe('ab\nc');
        // A value that is only control characters is empty after stripping.
        rejects(() => v.parseTransaction(tx({ category: '\u0000\u0001' })), /category must be 1-50/);
    });

    test('amount limits and decimals', () => {
        expect(v.parseTransaction(tx({ amount: 0.01 })).amount).toBe(0.01);
        expect(v.parseTransaction(tx({ amount: 1_000_000_000 })).amount).toBe(1_000_000_000);
        expect(v.parseTransaction(tx({ amount: 0.1 + 0.2 })).amount).toBe(0.3); // float noise is not a third decimal
        expect(v.parseTransaction(tx({ amount: '99.90' })).amount).toBe(99.9);
        rejects(() => v.parseTransaction(tx({ amount: 1_000_000_000.01 })), /at most 1,000,000,000/);
        rejects(() => v.parseTransaction(tx({ amount: 12.345 })), /at most 2 decimal places/);
        rejects(() => v.parseTransaction(tx({ amount: '12.345' })), /at most 2 decimal places/);
        for (const amount of ['1e3', '0x10', '12,50', ' ', 'Infinity', true, [5], { n: 1 }]) {
            rejects(() => v.parseTransaction(tx({ amount })));
        }
    });

    test('category characters and length', () => {
        for (const category of ['Food & Dining', 'Bills/Utilities', "Kids' (school)", 'Misc. 2026', 'Tea, Coffee', 'Re-sale', 'తెలుగు', 'Café']) {
            expect(v.parseTransaction(tx({ category })).category).toBe(category);
        }
        expect(v.parseTransaction(tx({ category: 'x'.repeat(50) })).category).toHaveLength(50);
        rejects(() => v.parseTransaction(tx({ category: 'x'.repeat(51) })), /category must be 1-50/);
        for (const category of ['=SUM(A1)', '<script>', 'a;b', 'a_b', 'Food!', 'a"b', 'a\tb c%']) {
            rejects(() => v.parseTransaction(tx({ category })), /category may only contain/);
        }
    });

    test('date rules', () => {
        expect(v.parseTransaction(tx({ date: '1970-01-01' })).date).toBe('1970-01-01T00:00:00.000Z');
        expect(v.parseTransaction(tx({ date: '2026-03-01T10:30:00+05:30' })).date).toBe('2026-03-01T05:00:00.000Z');
        expect(v.parseTransaction(tx({ date: '2026-03-01T10:30:00.123Z' })).date).toBe('2026-03-01T10:30:00.123Z');
        expect(v.parseTransaction(tx({ date: '2026-03-01T10:30' })).date).toBe('2026-03-01T10:30:00.000Z');
        expect(v.parseTransaction(tx({ date: new Date(Date.now() + DAY / 2).toISOString() })).date).toBeTruthy();
        rejects(() => v.parseTransaction(tx({ date: '1969-12-31' })), /before 1970-01-01/);
        rejects(() => v.parseTransaction(tx({ date: isoDay(3) })), /more than 1 day in the future/);
        for (const date of ['yesterday', '2026-02-30', '2026-13-01', '01/02/2026', '2026-1-2', '2026-01-02T25:00', 1700000000000, '']) {
            if (date === '') continue; // empty means "not provided", the DB default applies
            rejects(() => v.parseTransaction(tx({ date })), /valid ISO date/);
        }
    });

    test.each([
        ['negative amount', { amount: -1 }],
        ['zero amount', { amount: 0 }],
        ['text amount', { amount: 'abc' }],
        ['huge amount', { amount: 1e12 }],
        ['bad type', { type: 'gift' }],
        ['non-string type', { type: ['income'] }],
        ['non-string description', { description: 42 }],
        ['long category', { category: 'x'.repeat(51) }],
        ['bad date', { date: 'yesterday' }],
        ['object injection', { category: { $ne: null } }],
    ])('rejects %s', (_, over) => {
        rejects(() => v.parseTransaction(tx(over)));
    });

    test('requires amount, type and category on create but not on partial update', () => {
        rejects(() => v.parseTransaction({}), /amount is required, type is required, category is required/);
        expect(v.parseTransaction({ amount: 5 }, true)).toEqual({ amount: 5 });
        rejects(() => v.parseTransaction({}, true), /Nothing to update/);
        rejects(() => v.parseTransaction({ foo: 1 }, true), /Nothing to update/);
    });

    test('lists every problem in details', () => {
        try {
            v.parseTransaction({ amount: -1, type: 'x', category: '' });
            throw new Error('should have thrown');
        } catch (e) {
            expect(e.details).toEqual(['amount must be greater than 0', 'type must be income or expense', 'category is required']);
        }
    });

    test('rejects non-object bodies', () => {
        rejects(() => v.parseTransaction([tx()]), /JSON object/);
        rejects(() => v.parseTransaction(null), /JSON object/);
        rejects(() => v.parseTransaction('x'), /JSON object/);
    });
});

describe('validateImportRow / parseImportBody', () => {
    const row = (over = {}) => ({ date: '2026-10-01', description: 'Coffee', amount: '120.50', type: 'expense', category: 'Food', ...over });

    test('valid row is cleaned and unknown fields dropped', () => {
        expect(v.validateImportRow(row({ import_hash: 'client', source: 'manual', user_id: 'x', payment_method: 'card' }))).toEqual({
            value: { date: '2026-10-01T00:00:00.000Z', description: 'Coffee', amount: 120.5, type: 'expense', category: 'Food', payment_method: 'card' },
        });
    });

    test('date is required for import rows', () => {
        expect(v.validateImportRow(row({ date: undefined }))).toEqual({ errors: ['date is required'] });
    });

    test('collects all errors for a row without throwing', () => {
        const out = v.validateImportRow(row({ amount: '-5', type: 'debit', category: '=cmd' }));
        expect(out.errors).toEqual([
            'amount must be greater than 0',
            'type must be income or expense',
            "category may only contain letters, numbers, spaces and & - / . , ' ( )",
        ]);
        expect(v.validateImportRow('nope')).toEqual({ errors: ['Expected a JSON object'] });
        expect(v.validateImportRow(null)).toEqual({ errors: ['Expected a JSON object'] });
    });

    test('body shape', () => {
        expect(v.parseImportBody({ fileName: ' bank.csv ', rows: [row()] })).toEqual({ fileName: 'bank.csv', rows: [row()] });
        rejects(() => v.parseImportBody({ rows: [row()] }), /fileName is required/);
        rejects(() => v.parseImportBody({ fileName: 'x'.repeat(201), rows: [row()] }), /fileName must be 1-200/);
        rejects(() => v.parseImportBody({ fileName: 5, rows: [row()] }), /fileName must be text/);
        rejects(() => v.parseImportBody({ fileName: 'a.csv', rows: [] }), /1-2000/);
        rejects(() => v.parseImportBody({ fileName: 'a.csv', rows: new Array(2001).fill(row()) }), /1-2000/);
        rejects(() => v.parseImportBody({ fileName: 'a.csv', rows: 'x' }), /rows must be an array/);
        rejects(() => v.parseImportBody([]), /JSON object/);
        expect(v.parseImportBody({ fileName: 'a.csv', rows: new Array(2000).fill(row()) }).rows).toHaveLength(2000);
    });
});

describe('parseBudget', () => {
    test('maps limit to limit_amount and applies the amount and category rules', () => {
        expect(v.parseBudget({ category: 'Food', limit: '500' })).toEqual({ category: 'Food', limit_amount: 500 });
        expect(v.parseBudget({ limit: 10, category: 'ignored on update' }, true)).toEqual({ limit_amount: 10 });
        rejects(() => v.parseBudget({ category: 'Food', limit: 0 }));
        rejects(() => v.parseBudget({ category: 'Food', limit: 10.001 }), /2 decimal/);
        rejects(() => v.parseBudget({ category: 'Food', limit: 2e9 }), /at most/);
        rejects(() => v.parseBudget({ category: 'Food<>', limit: 10 }), /may only contain/);
    });
});

describe('parseSavingsGoal', () => {
    const goal = (over = {}) => ({ title: 'Laptop', target_amount: 80000, ...over });

    test('valid goal with a future due date', () => {
        expect(v.parseSavingsGoal(goal({ due_date: '2099-06-01T10:00:00Z', category: 'Tech' }))).toEqual({
            title: 'Laptop',
            target_amount: 80000,
            due_date: '2099-06-01',
            category: 'Tech',
        });
        expect(v.parseSavingsGoal(goal({ due_date: isoDay(0) })).due_date).toBe(isoDay(0));
        expect(v.parseSavingsGoal({ current_amount: 0 }, true)).toEqual({ current_amount: 0 });
    });

    test('due date in the past is rejected on create but allowed on update', () => {
        rejects(() => v.parseSavingsGoal(goal({ due_date: '2020-01-01' })), /cannot be in the past/);
        expect(v.parseSavingsGoal({ due_date: '2020-01-01' }, true)).toEqual({ due_date: '2020-01-01' });
        rejects(() => v.parseSavingsGoal(goal({ due_date: 'soon' })), /valid date/);
        rejects(() => v.parseSavingsGoal(goal({ due_date: '2099-02-30' })), /valid date/);
    });

    test('title, category and amounts', () => {
        rejects(() => v.parseSavingsGoal(goal({ title: 'x'.repeat(101) })), /title must be 1-100/);
        rejects(() => v.parseSavingsGoal(goal({ category: 'x'.repeat(51) })), /category must be at most 50/);
        expect(v.parseSavingsGoal(goal({ category: '' })).category).toBe('');
        expect(v.parseSavingsGoal(goal({ current_amount: 800000 })).current_amount).toBe(800000); // exactly 10x
        rejects(() => v.parseSavingsGoal(goal({ current_amount: 800000.01 })), /10 times/);
        rejects(() => v.parseSavingsGoal(goal({ current_amount: -1 })), /zero or more/);
        rejects(() => v.parseSavingsGoal(goal({ target_amount: 0 })), /greater than 0/);
        rejects(() => v.parseSavingsGoal(goal({ target_amount: 1.005 })), /2 decimal/);
    });

    test('checkGoalAmounts', () => {
        expect(() => v.checkGoalAmounts(100, 1000)).not.toThrow();
        expect(() => v.checkGoalAmounts('100.00', '1000.01')).toThrow(/10 times/);
        expect(() => v.checkGoalAmounts(undefined, 5)).not.toThrow();
    });
});

describe('parseCredentials', () => {
    test('register needs a strong password and a valid name', () => {
        expect(v.parseCredentials({ name: 'Teja', email: ' A@B.co ', password: 'Passw0rd' }, { withName: true })).toEqual({
            name: 'Teja',
            email: 'a@b.co',
            password: 'Passw0rd',
        });
        for (const password of ['short1A', 'alllowercase1', 'ALLUPPER1', 'NoDigitsHere', `Aa1${'x'.repeat(70)}`]) {
            rejects(() => v.parseCredentials({ name: 'Teja', email: 'a@b.co', password }, { withName: true }));
        }
        expect(v.parseCredentials({ name: 'x', email: 'a@b.co', password: `Aa1${'x'.repeat(69)}` }, { withName: true }).password).toHaveLength(72);
    });

    test('name rules', () => {
        for (const name of ["Mary-Jane O'Neil", 'J. R. R. Tolkien', 'తేజ మల్లం', 'José']) {
            expect(v.parseCredentials({ name, email: 'a@b.co', password: 'Passw0rd' }, { withName: true }).name).toBe(name);
        }
        for (const name of ['', 'x'.repeat(61), 'R2D2', '<b>', 'a_b', 42]) {
            rejects(() => v.parseCredentials({ name, email: 'a@b.co', password: 'Passw0rd' }, { withName: true }));
        }
        rejects(() => v.parseCredentials({ email: 'a@b.co', password: 'Passw0rd' }, { withName: true }), /name is required/);
    });

    test('email rules', () => {
        rejects(() => v.parseCredentials({ email: `${'a'.repeat(250)}@b.co`, password: 'x' }), /valid email/);
        expect(v.parseCredentials({ email: `${'a'.repeat(249)}@b.co`, password: 'x' }).email).toHaveLength(254);
    });

    test('login rejects non-string or malformed input', () => {
        rejects(() => v.parseCredentials({ email: { $ne: null }, password: 'x' }));
        rejects(() => v.parseCredentials({ email: 'not-an-email', password: 'x' }));
        rejects(() => v.parseCredentials({ email: 'a@b.co' }));
        rejects(() => v.parseCredentials({ email: 'a@b.co', password: { $gt: '' } }));
    });
});

describe('parsePasswordChange', () => {
    test('valid change', () => {
        expect(v.parsePasswordChange({ currentPassword: 'old', newPassword: 'Passw0rd!', x: 1 })).toEqual({
            currentPassword: 'old',
            newPassword: 'Passw0rd!',
        });
    });
    test('weak, missing or unchanged passwords', () => {
        rejects(() => v.parsePasswordChange({ currentPassword: 'old', newPassword: 'weak' }), /New password: password must be 8-72/);
        rejects(() => v.parsePasswordChange({ currentPassword: 'old', newPassword: 'alllower1' }), /uppercase/);
        rejects(() => v.parsePasswordChange({ newPassword: 'Passw0rd' }), /currentPassword is required/);
        rejects(() => v.parsePasswordChange({ currentPassword: 'Passw0rd', newPassword: 'Passw0rd' }), /different/);
        rejects(() => v.parsePasswordChange(null));
    });
});

test('isUuid', () => {
    expect(v.isUuid('3f1c2a4e-8b6d-4c2a-9e1f-0a1b2c3d4e5f')).toBe(true);
    for (const bad of ['1', '507f1f77bcf86cd799439011', '../etc', null, 42]) expect(v.isUuid(bad)).toBe(false);
});

describe('parsePreferences', () => {
    test('accepts every preference and drops unknown keys', () => {
        const all = {
            theme: 'dark',
            currency: 'INR',
            notifications: false,
            month_start_day: 28,
            date_format: 'YYYY-MM-DD',
            week_start: 'sunday',
            monthly_income_target: 50000.5,
            budget_alerts: false,
            name: 'Teja M',
        };
        expect(v.parsePreferences({ ...all, id: 'x', email: 'e@x.co' })).toEqual(all);
        expect(v.parsePreferences({ monthly_income_target: null })).toEqual({ monthly_income_target: null });
        expect(v.parsePreferences({ monthly_income_target: '1200' })).toEqual({ monthly_income_target: 1200 });
        for (const c of ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD', 'JPY']) {
            expect(v.parsePreferences({ currency: c })).toEqual({ currency: c });
        }
    });

    test.each([
        [{ theme: 'neon' }, /theme must be light or dark/],
        [{ currency: 'XYZ' }, /currency must be one of/],
        [{ currency: 'inr' }, /currency/],
        [{ notifications: 'yes' }, /notifications must be true or false/],
        [{ month_start_day: 0 }, /month_start_day must be a whole number from 1 to 28/],
        [{ month_start_day: 29 }, /month_start_day/],
        [{ month_start_day: 1.5 }, /month_start_day/],
        [{ month_start_day: '5' }, /month_start_day/],
        [{ date_format: 'DD-MM-YYYY' }, /date_format must be one of/],
        [{ week_start: 'friday' }, /week_start must be monday or sunday/],
        [{ monthly_income_target: 0 }, /greater than 0/],
        [{ monthly_income_target: 1.234 }, /2 decimal/],
        [{ monthly_income_target: 2e9 }, /at most/],
        [{ budget_alerts: 1 }, /budget_alerts must be true or false/],
        [{ name: 'R2D2' }, /name may only contain/],
        [{ name: '' }, /name must be 1-60/],
        [{ theme: null }, /theme cannot be empty/],
        [{}, /Nothing to update/],
        [{ unknown: 1 }, /Nothing to update/],
    ])('rejects %j', (body, re) => {
        rejects(() => v.parsePreferences(body), re);
    });
});

describe('parseTransactionQuery', () => {
    test('defaults', () => {
        expect(v.parseTransactionQuery({})).toEqual({ page: 1, limit: 100 });
        expect(v.parseTransactionQuery({ type: '', category: '', q: '   ' })).toEqual({ page: 1, limit: 100 });
    });

    test('valid filters', () => {
        expect(
            v.parseTransactionQuery({
                page: '3',
                limit: '500',
                type: 'income',
                category: ' Food ',
                q: 'rent, (june)',
                source: 'import',
                payment_method: 'upi',
                startDate: '2026-01-01',
                endDate: '2026-01-31',
            })
        ).toEqual({
            page: 3,
            limit: 500,
            type: 'income',
            category: 'Food',
            q: 'rent, (june)',
            source: 'import',
            payment_method: 'upi',
            startDate: '2026-01-01T00:00:00.000Z',
            endDate: '2026-01-31T23:59:59.999Z', // a date-only end includes the whole day
        });
        expect(v.parseTransactionQuery({ endDate: '2026-01-31T10:00:00Z' }).endDate).toBe('2026-01-31T10:00:00.000Z');
        expect(v.parseTransactionQuery({ startDate: '2026-01-31', endDate: '2026-01-31' })).toMatchObject({ startDate: '2026-01-31T00:00:00.000Z' });
        expect(v.parseTransactionQuery({ page: '10000', limit: '1' })).toMatchObject({ page: 10000, limit: 1 });
    });

    test.each([
        [{ page: '0' }, /page must be a whole number from 1 to 10000/],
        [{ page: '10001' }, /page/],
        [{ page: '1.5' }, /page/],
        [{ page: '-1' }, /page/],
        [{ limit: '0' }, /limit must be a whole number from 1 to 500/],
        [{ limit: '501' }, /limit/],
        [{ limit: 'abc' }, /limit/],
        [{ type: 'all' }, /type must be income or expense/],
        [{ type: ['income', 'expense'] }, /type must be given once/],
        [{ category: 'x'.repeat(51) }, /category must be at most 50/],
        [{ q: 'x'.repeat(101) }, /q must be at most 100/],
        [{ source: 'bank' }, /source must be manual or import/],
        [{ payment_method: 'cheque' }, /payment_method must be one of/],
        [{ startDate: 'yesterday' }, /startDate must be a valid ISO date/],
        [{ endDate: '2026-02-30' }, /endDate must be a valid ISO date/],
        [{ startDate: '2026-02-01', endDate: '2026-01-31' }, /endDate must be on or after startDate/],
        [{ q: { $ne: '' } }, /q must be given once/],
    ])('rejects %j', (query, re) => {
        rejects(() => v.parseTransactionQuery(query), re);
    });
});

describe('payees', () => {
    const { parsePayee, parsePayeeKey, parseTransaction } = require('../../src/validate');
    it('accepts upi and name keys and a 1-100 character name', () => {
        expect(parsePayee({ key: 'upi:9866352390-2', name: 'Pullaiah Mallam' })).toEqual({ key: 'upi:9866352390-2', name: 'Pullaiah Mallam' });
        expect(parsePayeeKey('name:swiggy')).toBe('name:swiggy');
    });
    it('rejects bad keys and names', () => {
        expect(() => parsePayeeKey('UPI:ABC')).toThrow();
        expect(() => parsePayeeKey('upi:')).toThrow();
        expect(() => parsePayeeKey('x:abcdef')).toThrow();
        expect(() => parsePayee({ key: 'upi:abc', name: '' })).toThrow();
        expect(() => parsePayee({ key: 'upi:abc', name: 'x'.repeat(101) })).toThrow();
    });
    it('lets transactions carry a payee_key', () => {
        const t = parseTransaction({ amount: 10, type: 'expense', category: 'Food', payee_key: 'upi:swiggy' });
        expect(t.payee_key).toBe('upi:swiggy');
        expect(() => parseTransaction({ amount: 10, type: 'expense', category: 'Food', payee_key: 'bad' })).toThrow();
    });
});
