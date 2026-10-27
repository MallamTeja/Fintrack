// Route logic with Supabase replaced by an in-memory fake (no network, no database).
// The integration suite covers the same routes against a real local Supabase.
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:1';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'unit-test-placeholder';

jest.mock('../../src/auth', () => ({
    requireAuth: (req, res, next) => {
        req.user = { id: '11111111-1111-4111-8111-111111111111', email: 'me@example.com' };
        req.accessToken = 'bearer-token';
        req.db = global.fakeDb;
        next();
    },
}));
jest.mock('../../src/supabase', () => ({ anonClient: jest.fn(), userClient: jest.fn(), isolatedClient: jest.fn() }));

const request = require('supertest');
const app = require('../../src/app');
const { isolatedClient } = require('../../src/supabase');
const { importHash } = require('../../src/csv');

/**
 * Chainable stand-in for the supabase-js query builder. Every call is recorded in
 * `state.ops`; awaiting the chain resolves to `handler(state)`.
 */
function makeDb(handler) {
    const calls = [];
    const chain = (state) => {
        calls.push(state);
        const proxy = new Proxy(
            {},
            {
                get(_, prop) {
                    if (prop === 'then') {
                        return (resolve, reject) => Promise.resolve().then(() => handler(state)).then(resolve, reject);
                    }
                    return (...args) => {
                        state.ops.push([prop, ...args]);
                        return proxy;
                    };
                },
            }
        );
        return proxy;
    };
    return {
        calls,
        from: (table) => chain({ table, ops: [] }),
        rpc: (fn, args) => chain({ rpc: fn, args, ops: [] }),
    };
}
const op = (state, name) => state.ops.find((o) => o[0] === name);
const has = (state, name) => Boolean(op(state, name));

const row = (over = {}) => ({ date: '2026-10-01', description: 'Coffee', amount: 120.5, type: 'expense', category: 'Food', ...over });

afterEach(() => {
    global.fakeDb = undefined;
    jest.restoreAllMocks();
});

describe('POST /api/transactions/import', () => {
    test('inserts new rows, counts batch and earlier duplicates, reports invalid rows', async () => {
        const earlier = importHash({ ...row({ description: 'Tea' }), date: '2026-10-01T00:00:00.000Z' });
        let inserted;
        global.fakeDb = makeDb((s) => {
            if (has(s, 'select') && has(s, 'in')) return { data: [{ import_hash: earlier }], error: null };
            if (has(s, 'insert')) {
                inserted = op(s, 'insert');
                return { data: null, error: null };
            }
            throw new Error(`unexpected query ${JSON.stringify(s)}`);
        });
        const res = await request(app)
            .post('/api/transactions/import')
            .send({
                fileName: 'statement.csv',
                rows: [row(), row({ description: ' COFFEE ' }), row({ description: 'Tea' }), row({ amount: 'abc' }), row({ type: 'income', category: 'Salary', amount: 100, import_hash: 'x' })],
            });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            success: true,
            data: { received: 5, inserted: 2, duplicates: 2, invalid: [{ index: 3, errors: ['amount must be a number'] }] },
        });
        const [, rows, options] = inserted;
        expect(options).toEqual({ defaultToNull: false });
        expect(rows).toHaveLength(2);
        for (const r of rows) {
            expect(r).toMatchObject({ source: 'import', import_hash: importHash(r) });
            expect(r).not.toHaveProperty('user_id');
        }
    });

    test('falls back to row-by-row inserts when a concurrent import causes a conflict', async () => {
        let bulk = true;
        let single = 0;
        global.fakeDb = makeDb((s) => {
            if (has(s, 'in')) return { data: [], error: null };
            const rows = op(s, 'insert')[1];
            if (Array.isArray(rows) && bulk) {
                bulk = false;
                return { error: { code: '23505' } };
            }
            single += 1;
            return { error: single === 1 ? { code: '23505' } : null };
        });
        const res = await request(app)
            .post('/api/transactions/import')
            .send({ fileName: 'a.csv', rows: [row(), row({ amount: 1 }), row({ amount: 2 })] });
        expect(res.body.data).toEqual({ received: 3, inserted: 2, duplicates: 1, invalid: [] });
    });

    test('nothing valid means no insert', async () => {
        global.fakeDb = makeDb(() => {
            throw new Error('no query expected');
        });
        const res = await request(app).post('/api/transactions/import').send({ fileName: 'a.csv', rows: [{}, 5] });
        expect(res.body.data).toEqual({
            received: 2,
            inserted: 0,
            duplicates: 0,
            invalid: [
                { index: 0, errors: ['amount is required', 'type is required', 'category is required', 'date is required'] },
                { index: 1, errors: ['Expected a JSON object'] },
            ],
        });
    });

    test('2000 rows: duplicate lookups are chunked, body over 50kb is accepted', async () => {
        global.fakeDb = makeDb((s) => (has(s, 'in') ? { data: [], error: null } : { error: null }));
        const rows = Array.from({ length: 2000 }, (_, i) => row({ amount: i + 1, description: `Item number ${i}` }));
        const res = await request(app).post('/api/transactions/import').send({ fileName: 'big.csv', rows });
        expect(res.status).toBe(200);
        expect(res.body.data.inserted).toBe(2000);
        const lookups = global.fakeDb.calls.filter((s) => has(s, 'in'));
        expect(lookups).toHaveLength(20);
        for (const s of lookups) expect(op(s, 'in')[2].length).toBeLessThanOrEqual(100);
    });

    test('rejects bad bodies with 400 and very large bodies with 413', async () => {
        global.fakeDb = makeDb(() => ({ data: [], error: null }));
        expect((await request(app).post('/api/transactions/import').send({ fileName: 'a.csv', rows: [] })).status).toBe(400);
        expect((await request(app).post('/api/transactions/import').send({ rows: [row()] })).status).toBe(400);
        const huge = { fileName: 'a.csv', rows: [row({ description: 'x'.repeat(1100 * 1024) })] };
        expect((await request(app).post('/api/transactions/import').send(huge)).status).toBe(413);
    });

    test('database errors become a generic 500', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        global.fakeDb = makeDb(() => ({ data: null, error: { code: 'XX000', message: 'secret internals' } }));
        const res = await request(app).post('/api/transactions/import').send({ fileName: 'a.csv', rows: [row()] });
        expect(res.status).toBe(500);
        expect(JSON.stringify(res.body)).not.toContain('secret');
    });
});

describe('GET /api/transactions/categories', () => {
    test('counts (category, type) pairs across pages, most used first', async () => {
        const page1 = [
            ...new Array(600).fill({ category: 'Food', type: 'expense' }),
            ...new Array(399).fill({ category: 'Rent', type: 'expense' }),
            { category: 'Food', type: 'income' },
        ];
        const page2 = [{ category: 'Rent', type: 'expense' }, { category: 'Salary', type: 'income' }];
        global.fakeDb = makeDb((s) => ({ data: op(s, 'range')[1] === 0 ? page1 : page2, error: null }));
        const res = await request(app).get('/api/transactions/categories');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            success: true,
            data: [
                { category: 'Food', type: 'expense', count: 600 },
                { category: 'Rent', type: 'expense', count: 400 },
                { category: 'Food', type: 'income', count: 1 },
                { category: 'Salary', type: 'income', count: 1 },
            ],
        });
        expect(global.fakeDb.calls).toHaveLength(2);
    });
});

describe('GET /api/transactions/export.csv', () => {
    test('streams escaped CSV as an attachment, filtered by date', async () => {
        global.fakeDb = makeDb(() => ({
            data: [
                { date: '2026-10-02T10:00:00+00:00', type: 'expense', category: 'Food', description: '=1+1', amount: '12.5', payment_method: 'upi', notes: '', source: 'manual' },
            ],
            error: null,
        }));
        const res = await request(app).get('/api/transactions/export.csv?startDate=2026-10-01&endDate=2026-10-31');
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
        expect(res.headers['content-disposition']).toMatch(/^attachment; filename="fintrack-\d{4}-\d{2}-\d{2}\.csv"$/);
        expect(res.text).toBe(
            "date,type,category,description,amount,payment_method,notes,source\r\n2026-10-02,expense,Food,'=1+1,12.50,upi,,manual\r\n"
        );
        const [q] = global.fakeDb.calls;
        expect(op(q, 'gte')).toEqual(['gte', 'date', '2026-10-01T00:00:00.000Z']);
        expect(op(q, 'lte')).toEqual(['lte', 'date', '2026-10-31T23:59:59.999Z']);
    });

    test('invalid date range is a 400', async () => {
        global.fakeDb = makeDb(() => ({ data: [], error: null }));
        const res = await request(app).get('/api/transactions/export.csv?startDate=2026-10-31&endDate=2026-10-01');
        expect(res.status).toBe(400);
    });
});

describe('GET /api/transactions filters', () => {
    test('q searches description and category literally; other filters map to columns', async () => {
        global.fakeDb = makeDb(() => ({ data: [], count: 0, error: null }));
        const res = await request(app)
            .get('/api/transactions')
            .query({ q: '50%_off, "x" (a\\b)*', source: 'import', payment_method: 'card', type: 'expense', category: '100%', page: '2', limit: '10' });
        expect(res.status).toBe(200);
        expect(res.body.pagination).toEqual({ page: 2, limit: 10, total: 0, totalPages: 0 });
        const [q] = global.fakeDb.calls;
        const pattern = '"%50\\\\%\\\\_off, \\"x\\" (a\\\\\\\\b)_%"';
        expect(op(q, 'or')).toEqual(['or', `description.ilike.${pattern},category.ilike.${pattern}`]);
        expect(op(q, 'ilike')).toEqual(['ilike', 'category', '%100\\%%']);
        expect(q.ops).toEqual(expect.arrayContaining([['eq', 'type', 'expense'], ['eq', 'source', 'import'], ['eq', 'payment_method', 'card'], ['range', 10, 19]]));
    });

    test('invalid query parameters are a 400 with a clear message', async () => {
        global.fakeDb = makeDb(() => ({ data: [], count: 0, error: null }));
        const res = await request(app).get('/api/transactions?limit=1000');
        expect(res.status).toBe(400);
        expect(res.body.error.message).toBe('limit must be a whole number from 1 to 500');
    });

    test('a page past the end is an empty page, not an error', async () => {
        global.fakeDb = makeDb((s) =>
            has(s, 'range') ? { data: null, error: { code: 'PGRST103' } } : { data: null, count: 3, error: null }
        );
        const res = await request(app).get('/api/transactions?page=5&limit=2');
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ data: [], pagination: { page: 5, limit: 2, total: 3, totalPages: 2 } });
    });
});

describe('auth: preferences, password, account', () => {
    const profile = {
        name: 'Teja',
        theme: 'dark',
        currency: 'USD',
        notifications: true,
        month_start_day: 5,
        date_format: 'YYYY-MM-DD',
        week_start: 'sunday',
        monthly_income_target: '50000.00',
        budget_alerts: false,
    };

    test('GET /me returns every preference', async () => {
        global.fakeDb = makeDb(() => ({ data: profile, error: null }));
        const res = await request(app).get('/api/auth/me');
        expect(res.body.data).toEqual({
            id: '11111111-1111-4111-8111-111111111111',
            email: 'me@example.com',
            name: 'Teja',
            preferences: { ...Object.fromEntries(Object.entries(profile).filter(([k]) => k !== 'name')), monthly_income_target: 50000 },
        });
    });

    test('PUT /preferences writes only allowed fields and returns them', async () => {
        let update;
        global.fakeDb = makeDb((s) => {
            update = op(s, 'update');
            return { data: { ...profile, monthly_income_target: null }, error: null };
        });
        const res = await request(app)
            .put('/api/auth/preferences')
            .send({ name: 'Teja', month_start_day: 5, monthly_income_target: null, user_id: 'x', id: 'y' });
        expect(res.status).toBe(200);
        expect(update[1]).toEqual({ name: 'Teja', month_start_day: 5, monthly_income_target: null });
        expect(res.body.preferences).toMatchObject({ month_start_day: 5, monthly_income_target: null, budget_alerts: false });
        expect(res.body.user.name).toBe('Teja');
    });

    describe('POST /password', () => {
        const signIn = jest.fn();
        beforeEach(() => {
            signIn.mockReset();
            isolatedClient.mockReturnValue({ auth: { signInWithPassword: signIn } });
            global.fakeDb = makeDb(() => ({}));
        });
        const okSession = { data: { user: { id: '11111111-1111-4111-8111-111111111111' }, session: { access_token: 'fresh-token' } }, error: null };

        test('weak new password is a 400 before any auth call', async () => {
            const res = await request(app).post('/api/auth/password').send({ currentPassword: 'Old1pass', newPassword: 'weak' });
            expect(res.status).toBe(400);
            expect(signIn).not.toHaveBeenCalled();
        });

        test('wrong current password is a 401', async () => {
            signIn.mockResolvedValue({ data: { user: null, session: null }, error: { status: 400, message: 'Invalid login credentials' } });
            const res = await request(app).post('/api/auth/password').send({ currentPassword: 'Wrong1pass', newPassword: 'NewPassw0rd' });
            expect(res.status).toBe(401);
            expect(signIn).toHaveBeenCalledWith({ email: 'me@example.com', password: 'Wrong1pass' });
        });

        test('success signs out the check session, then updates the password with the caller token', async () => {
            signIn.mockResolvedValue(okSession);
            const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async () => new Response('{}', { status: 200 }));
            const res = await request(app).post('/api/auth/password').send({ currentPassword: 'Old1pass', newPassword: 'NewPassw0rd' });
            expect(res.status).toBe(200);
            const [[logoutUrl, logoutInit], [url, init]] = fetchMock.mock.calls;
            expect(logoutUrl).toBe(`${process.env.SUPABASE_URL}/auth/v1/logout?scope=local`);
            expect(logoutInit.headers.Authorization).toBe('Bearer fresh-token');
            expect(url).toBe(`${process.env.SUPABASE_URL}/auth/v1/user`);
            expect(init.method).toBe('PUT');
            expect(init.headers.Authorization).toBe('Bearer bearer-token');
            expect(JSON.parse(init.body)).toEqual({ password: 'NewPassw0rd' });
        });

        test('password rejected by Supabase is a 400', async () => {
            signIn.mockResolvedValue(okSession);
            jest.spyOn(global, 'fetch').mockImplementation(async (url) =>
                url.endsWith('/user') ? new Response(JSON.stringify({ error_code: 'weak_password' }), { status: 422 }) : new Response('{}')
            );
            const res = await request(app).post('/api/auth/password').send({ currentPassword: 'Old1pass', newPassword: 'NewPassw0rd' });
            expect(res.status).toBe(400);
            expect(res.body.error.message).toBe('New password is too weak');
        });
    });

    test('DELETE /account needs the confirmation word, then calls delete_my_account as the user', async () => {
        global.fakeDb = makeDb(() => ({ data: null, error: null }));
        expect((await request(app).delete('/api/auth/account').send({ confirm: 'delete' })).status).toBe(400);
        expect((await request(app).delete('/api/auth/account')).status).toBe(400);
        expect(global.fakeDb.calls).toHaveLength(0);
        const res = await request(app).delete('/api/auth/account').send({ confirm: 'DELETE' });
        expect(res.status).toBe(200);
        expect(global.fakeDb.calls).toEqual([{ rpc: 'delete_my_account', args: undefined, ops: [] }]);
    });
});

describe('savings goals: 10x rule on partial updates', () => {
    const id = '22222222-2222-4222-8222-222222222222';
    test('current_amount is checked against the stored target', async () => {
        global.fakeDb = makeDb((s) =>
            has(s, 'update')
                ? { data: { id, title: 'x', target_amount: '100', current_amount: '1000' }, error: null }
                : { data: { target_amount: '100.00', current_amount: '0.00' }, error: null }
        );
        expect((await request(app).patch(`/api/savings-goals/${id}`).send({ current_amount: 1000.01 })).status).toBe(400);
        expect((await request(app).patch(`/api/savings-goals/${id}`).send({ current_amount: 1000 })).status).toBe(200);
    });
    test('lowering the target below a tenth of the saved amount is rejected', async () => {
        global.fakeDb = makeDb(() => ({ data: { target_amount: '100.00', current_amount: '900.00' }, error: null }));
        expect((await request(app).patch(`/api/savings-goals/${id}`).send({ target_amount: 89.99 })).status).toBe(400);
    });
});

describe('payees', () => {
    const tx = (over = {}) => ({
        id: over.id || 'a', type: 'income', amount: '100.00', description: 'Pullaia H', category: 'Other income',
        notes: 'UPIAB/1/CR/PULLAIA H/SBIN/9866352390-2@ybl', payee_key: 'upi:9866352390-2', date: '2026-09-18T00:00:00+00:00', ...over,
    });

    test('GET /api/payees groups by payee_key, totals money both ways and prefers the saved name', async () => {
        global.fakeDb = makeDb((s) => {
            if (s.table === 'transactions') {
                return {
                    data: [
                        tx({ id: 'a' }),
                        tx({ id: 'b', amount: '5500', date: '2026-09-05T00:00:00+00:00' }),
                        tx({ id: 'c', type: 'expense', amount: '20', payee_key: 'upi:q018762163', description: 'Sri Maru', notes: 'x q018762163@yb' }),
                    ],
                    error: null,
                };
            }
            if (s.table === 'payees') return { data: [{ key: 'upi:9866352390-2', name: 'Pullaiah Mallam' }], error: null };
            throw new Error('unexpected');
        });
        const res = await request(app).get('/api/payees');
        expect(res.status).toBe(200);
        const byKey = Object.fromEntries(res.body.data.map((p) => [p.key, p]));
        expect(byKey['upi:9866352390-2']).toMatchObject({
            name: 'Pullaiah Mallam', named: true, count: 2, received: 5600, paid: 0, upi_id: '9866352390-2@ybl',
            first_date: '2026-09-05T00:00:00+00:00', last_date: '2026-09-18T00:00:00+00:00',
        });
        expect(byKey['upi:q018762163']).toMatchObject({ name: 'Sri Maru', named: false, paid: 20, upi_id: 'q018762163@yb' });
    });

    test('PUT /api/payees saves the name and renames every linked transaction', async () => {
        const seen = [];
        global.fakeDb = makeDb((s) => {
            seen.push(s);
            if (s.table === 'payees' && has(s, 'update')) return { data: [], error: null };
            if (s.table === 'payees' && has(s, 'insert')) return { data: [{ key: 'upi:abc', name: 'Ravi Kumar' }], error: null };
            if (s.table === 'transactions' && has(s, 'update')) return { data: [{ id: 1 }, { id: 2 }], error: null };
            throw new Error('unexpected');
        });
        const res = await request(app).put('/api/payees').send({ key: 'upi:abc', name: '  Ravi Kumar ' });
        expect(res.status).toBe(200);
        expect(res.body.data).toEqual({ key: 'upi:abc', name: 'Ravi Kumar', updated: 2 });
        const txUpdate = seen.find((s) => s.table === 'transactions');
        expect(op(txUpdate, 'update')[1]).toEqual({ description: 'Ravi Kumar' });
        expect(op(txUpdate, 'eq')).toEqual(['eq', 'payee_key', 'upi:abc']);
        expect(op(seen.find((s) => has(s, 'insert')), 'insert')[1]).toEqual({ key: 'upi:abc', name: 'Ravi Kumar' });
    });

    test('PUT /api/payees rejects bad keys', async () => {
        global.fakeDb = makeDb(() => {
            throw new Error('should not query');
        });
        const res = await request(app).put('/api/payees').send({ key: 'nope', name: 'X' });
        expect(res.status).toBe(400);
    });

    test('import uses the saved payee name and fingerprints by payee', async () => {
        let inserted;
        global.fakeDb = makeDb((s) => {
            if (s.table === 'transactions' && has(s, 'select')) return { data: [], error: null };
            if (s.table === 'payees') return { data: [{ key: 'upi:abc', name: 'Ravi Kumar' }], error: null };
            if (has(s, 'insert')) {
                inserted = op(s, 'insert')[1];
                return { data: null, error: null };
            }
            throw new Error('unexpected');
        });
        const res = await request(app)
            .post('/api/transactions/import')
            .send({ fileName: 's.pdf', rows: [row({ description: 'Ravi K', payee_key: 'upi:abc' }), row({ description: 'Tea' })] });
        expect(res.status).toBe(200);
        expect(inserted[0]).toMatchObject({ description: 'Ravi Kumar', payee_key: 'upi:abc' });
        expect(inserted[0].import_hash).toBe(importHash({ ...row({ description: 'Ravi K' }), payee_key: 'upi:abc' }));
        expect(inserted[1]).toMatchObject({ description: 'Tea', payee_key: null });
    });
});
