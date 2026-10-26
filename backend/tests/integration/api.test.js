// End-to-end tests against a real Supabase (local stack via `supabase start`, see README).
// They need SUPABASE_URL and SUPABASE_ANON_KEY pointing at a disposable project.
const request = require('supertest');

const configured = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
if (!configured && process.env.CI) throw new Error('CI must provide SUPABASE_URL and SUPABASE_ANON_KEY');
const maybe = configured ? describe : describe.skip;

const app = configured ? require('../../src/app') : null;
const PASSWORD = 'Passw0rd123';
let seq = 0;

async function signup(name = 'Test User') {
    seq += 1;
    const email = `user${Date.now()}_${seq}@example.com`;
    const res = await request(app).post('/api/auth/register').send({ name, email, password: PASSWORD });
    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String)); // local stack: email confirmation is off
    return { token: res.body.token, refreshToken: res.body.refreshToken, user: res.body.user, email };
}
const auth = (t) => ({ Authorization: `Bearer ${t}` });
const tx = (over = {}) => ({ description: 'Groceries', amount: 450, type: 'expense', category: 'Food', date: new Date().toISOString(), ...over });

maybe('auth', () => {
    test('register, login, me, refresh, logout', async () => {
        const { email, refreshToken } = await signup('Teja');
        const login = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
        expect(login.status).toBe(200);
        expect(JSON.stringify(login.body)).not.toContain(PASSWORD);

        const me = await request(app).get('/api/auth/me').set(auth(login.body.token));
        expect(me.status).toBe(200);
        expect(me.body.data).toMatchObject({ email, name: 'Teja', preferences: { theme: 'light', currency: 'INR' } });

        const refreshed = await request(app).post('/api/auth/refresh').send({ refreshToken });
        expect(refreshed.status).toBe(200);
        expect(refreshed.body.token).toEqual(expect.any(String));

        const out = await request(app).post('/api/auth/logout').set(auth(login.body.token));
        expect(out.status).toBe(200);
    });

    test('duplicate email is rejected', async () => {
        const { email } = await signup();
        const res = await request(app).post('/api/auth/register').send({ name: 'Again', email, password: PASSWORD });
        expect(res.status).toBe(409);
    });

    test('wrong password and unknown user get the same generic 401', async () => {
        const { email } = await signup();
        const a = await request(app).post('/api/auth/login').send({ email, password: 'Wrong1234' });
        const b = await request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'Wrong1234' });
        expect(a.status).toBe(401);
        expect(b.status).toBe(401);
        expect(a.body.error.message).toBe(b.body.error.message);
    });

    test('forged and garbage tokens are rejected', async () => {
        // Token-shaped string built at runtime (no token literal in the repo).
        const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
        const forged = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: '00000000-0000-4000-8000-000000000000', role: 'authenticated' })}.c2lnbmF0dXJl`;
        for (const t of [forged, 'garbage']) {
            expect((await request(app).get('/api/transactions').set(auth(t))).status).toBe(401);
        }
    });

    test('preferences update and validation', async () => {
        const { token } = await signup();
        const ok = await request(app).put('/api/auth/preferences').set(auth(token)).send({ theme: 'dark', currency: 'USD' });
        expect(ok.status).toBe(200);
        expect(ok.body.preferences).toMatchObject({ theme: 'dark', currency: 'USD' });
        expect((await request(app).put('/api/auth/preferences').set(auth(token)).send({ theme: 'neon' })).status).toBe(400);
    });
});

maybe('transactions', () => {
    test('full CRUD, filters and summary', async () => {
        const { token } = await signup();
        const a = await request(app).post('/api/transactions').set(auth(token)).send(tx());
        expect(a.status).toBe(201);
        expect(a.body.data).toMatchObject({ amount: 450, type: 'expense', _id: a.body.data.id });
        await request(app).post('/api/transactions').set(auth(token)).send(tx({ type: 'income', category: 'Salary', amount: 5000 }));

        const list = await request(app).get('/api/transactions').set(auth(token));
        expect(list.body.data).toHaveLength(2);
        expect(list.body.pagination.total).toBe(2);

        const incomeOnly = await request(app).get('/api/transactions?type=income').set(auth(token));
        expect(incomeOnly.body.data).toHaveLength(1);

        const literal = await request(app).get('/api/transactions').query({ category: '%' }).set(auth(token));
        expect(literal.body.data).toHaveLength(0); // wildcard is matched literally

        const sum = await request(app).get('/api/transactions/stats/summary').set(auth(token));
        expect(sum.body.data).toMatchObject({ income: 5000, expense: 450, balance: 4550 });

        const id = a.body.data.id;
        const put = await request(app).put(`/api/transactions/${id}`).set(auth(token)).send(tx({ amount: 500 }));
        expect(put.body.data.amount).toBe(500);
        const patch = await request(app).patch(`/api/transactions/${id}`).set(auth(token)).send({ description: 'Veg' });
        expect(patch.body.data).toMatchObject({ amount: 500, description: 'Veg' });

        expect((await request(app).delete(`/api/transactions/${id}`).set(auth(token))).status).toBe(200);
        expect((await request(app).get(`/api/transactions/${id}`).set(auth(token))).status).toBe(404);
    });

    test('invalid input is rejected', async () => {
        const { token } = await signup();
        const future = new Date(Date.now() + 3 * 86400000).toISOString();
        for (const bad of [tx({ amount: -1 }), tx({ amount: 12.345 }), tx({ type: 'gift' }), tx({ date: 'nope' }), tx({ date: future }), tx({ category: '=cmd' }), tx({ description: 7 })]) {
            expect((await request(app).post('/api/transactions').set(auth(token)).send(bad)).status).toBe(400);
        }
        expect((await request(app).get('/api/transactions/not-a-uuid').set(auth(token))).status).toBe(404);
        expect((await request(app).get('/api/transactions?limit=501').set(auth(token))).status).toBe(400);
        expect((await request(app).get('/api/transactions?startDate=2026-02-01&endDate=2026-01-01').set(auth(token))).status).toBe(400);
    });

    test('description is optional; notes, payment_method and source are returned', async () => {
        const { token } = await signup();
        const res = await request(app)
            .post('/api/transactions')
            .set(auth(token))
            .send({ amount: 99.5, type: 'expense', category: 'Food & Dining', notes: 'with friends', payment_method: 'upi', source: 'import' });
        expect(res.status).toBe(201);
        expect(res.body.data).toMatchObject({ description: '', notes: 'with friends', payment_method: 'upi', source: 'manual', amount: 99.5 });
        expect(res.body.data).not.toHaveProperty('import_hash');
        const patch = await request(app).patch(`/api/transactions/${res.body.data.id}`).set(auth(token)).send({ payment_method: 'card', notes: '' });
        expect(patch.body.data).toMatchObject({ payment_method: 'card', notes: '' });
    });

    test('q searches description and category literally, including PostgREST reserved characters', async () => {
        const { token } = await signup();
        await request(app).post('/api/transactions').set(auth(token)).send(tx({ description: 'Dinner, "Big" (party) 100%' }));
        await request(app).post('/api/transactions').set(auth(token)).send(tx({ description: 'Cab', category: 'Travel' }));
        const search = async (q) => (await request(app).get('/api/transactions').query({ q }).set(auth(token))).body.data;
        expect(await search('"big" (party) 100%')).toHaveLength(1);
        expect(await search('travel')).toHaveLength(1);
        expect(await search('zz%')).toHaveLength(0);
        expect(await search('_')).toHaveLength(0);
        expect(await search('a')).toHaveLength(2);
    });

    test('row level security: users cannot see or touch each other\'s rows', async () => {
        const alice = await signup('Alice');
        const bob = await signup('Bob');
        const { body } = await request(app).post('/api/transactions').set(auth(alice.token)).send(tx());
        const id = body.data.id;

        expect((await request(app).get('/api/transactions').set(auth(bob.token))).body.data).toHaveLength(0);
        expect((await request(app).get(`/api/transactions/${id}`).set(auth(bob.token))).status).toBe(404);
        expect((await request(app).put(`/api/transactions/${id}`).set(auth(bob.token)).send(tx({ amount: 1 }))).status).toBe(404);
        expect((await request(app).delete(`/api/transactions/${id}`).set(auth(bob.token))).status).toBe(404);

        const still = await request(app).get(`/api/transactions/${id}`).set(auth(alice.token));
        expect(still.body.data.amount).toBe(450);
    });
});

maybe('budgets', () => {
    test('CRUD with current month spending', async () => {
        const { token } = await signup();
        await request(app).post('/api/transactions').set(auth(token)).send(tx({ amount: 300 }));
        const created = await request(app).post('/api/budgets').set(auth(token)).send({ category: 'Food', limit: 5000 });
        expect(created.status).toBe(201);
        const id = created.body._id;

        expect((await request(app).post('/api/budgets').set(auth(token)).send({ category: 'Food', limit: 1 })).status).toBe(409);

        const list = await request(app).get('/api/budgets').set(auth(token));
        expect(list.body[0]).toMatchObject({ category: 'Food', limit: 5000, current_spending: 300 });

        expect((await request(app).put(`/api/budgets/${id}`).set(auth(token)).send({ limit: 6000 })).body.limit).toBe(6000);
        expect((await request(app).patch(`/api/budgets/${id}`).set(auth(token)).send({ limit: -5 })).status).toBe(400);
        expect((await request(app).delete(`/api/budgets/${id}`).set(auth(token))).status).toBe(200);
    });

    test('other users cannot delete my budget', async () => {
        const alice = await signup('Alice');
        const bob = await signup('Bob');
        const { body } = await request(app).post('/api/budgets').set(auth(alice.token)).send({ category: 'Rent', limit: 1000 });
        expect((await request(app).delete(`/api/budgets/${body._id}`).set(auth(bob.token))).status).toBe(404);
        expect((await request(app).get('/api/budgets').set(auth(alice.token))).body).toHaveLength(1);
    });
});

maybe('savings goals', () => {
    const nextYear = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
    const goal = { title: 'Laptop', target_amount: 80000, current_amount: 5000, category: 'Tech', due_date: nextYear };

    test('CRUD on both /api/savings-goals and /api/savings', async () => {
        const { token } = await signup();
        const created = await request(app).post('/api/savings-goals').set(auth(token)).send(goal);
        expect(created.status).toBe(201);
        const id = created.body._id;
        expect((await request(app).get('/api/savings').set(auth(token))).body).toHaveLength(1);
        expect((await request(app).patch(`/api/savings/${id}`).set(auth(token)).send({ current_amount: 9000 })).body.current_amount).toBe(9000);
        expect((await request(app).patch(`/api/savings/${id}`).set(auth(token)).send({ current_amount: 800001 })).status).toBe(400);
        expect((await request(app).post('/api/savings-goals').set(auth(token)).send({ ...goal, due_date: '2020-01-01' })).status).toBe(400);
        expect((await request(app).patch(`/api/savings/${id}`).set(auth(token)).send({ due_date: '2020-01-01' })).status).toBe(200);
        expect((await request(app).delete(`/api/savings-goals/${id}`).set(auth(token))).status).toBe(200);
    });

    test('a client cannot reassign a goal to another user', async () => {
        const alice = await signup('Alice');
        const bob = await signup('Bob');
        const { body } = await request(app).post('/api/savings-goals').set(auth(alice.token)).send(goal);
        await request(app).patch(`/api/savings-goals/${body._id}`).set(auth(alice.token)).send({ user_id: bob.user.id, title: 'Mine' });
        expect((await request(app).get('/api/savings-goals').set(auth(bob.token))).body).toHaveLength(0);
        expect((await request(app).get('/api/savings-goals').set(auth(alice.token))).body).toHaveLength(1);
    });
});

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const importRows = () => [
    { date: daysAgo(10), description: 'Coffee  Day', amount: '120.50', type: 'expense', category: 'Food' },
    { date: daysAgo(10), description: ' coffee day ', amount: 120.5, type: 'expense', category: 'Food' }, // same fingerprint
    { date: daysAgo(9), description: 'Salary', amount: 50000, type: 'income', category: 'Salary', payment_method: 'bank' },
    { date: daysAgo(8), description: 'Broken', amount: 'abc', type: 'expense', category: 'Food' },
    { date: daysAgo(8), description: 'Metro card', amount: 300, type: 'expense', category: 'Travel', notes: 'monthly', payment_method: 'card', import_hash: 'client-supplied' },
    { date: daysAgo(7), description: 'Lunch', amount: 250, type: 'expense', category: 'Food', source: 'manual' },
];
const doImport = (token, rows = importRows()) =>
    request(app).post('/api/transactions/import').set(auth(token)).send({ fileName: 'statement.csv', rows });

maybe('import, categories and export', () => {
    test('import inserts valid rows, reports invalid ones and dedupes within the batch', async () => {
        const { token } = await signup();
        const res = await doImport(token);
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ success: true, data: { received: 6, inserted: 4, duplicates: 1 } });
        expect(res.body.data.invalid).toEqual([{ index: 3, errors: ['amount must be a number'] }]);

        const imported = await request(app).get('/api/transactions?source=import').set(auth(token));
        expect(imported.body.data).toHaveLength(4);
        expect(imported.body.data.every((t) => t.source === 'import' && !('import_hash' in t))).toBe(true);
        expect(imported.body.data.find((t) => t.description === 'Metro card')).toMatchObject({ notes: 'monthly', payment_method: 'card', amount: 300 });
        expect((await request(app).get('/api/transactions?source=manual').set(auth(token))).body.data).toHaveLength(0);
        expect((await request(app).get('/api/transactions?payment_method=bank').set(auth(token))).body.data).toHaveLength(1);
    });

    test('re-importing the same file only reports duplicates', async () => {
        const { token } = await signup();
        await doImport(token);
        const again = await doImport(token);
        expect(again.body.data).toMatchObject({ received: 6, inserted: 0, duplicates: 5 });
        expect(again.body.data.invalid).toHaveLength(1);
        expect((await request(app).get('/api/transactions').set(auth(token))).body.pagination.total).toBe(4);
    });

    test('imported rows are isolated per user', async () => {
        const alice = await signup('Alice');
        const bob = await signup('Bob');
        await doImport(alice.token);
        const bobs = await doImport(bob.token); // same fingerprints, different user: not duplicates
        expect(bobs.body.data).toMatchObject({ inserted: 4, duplicates: 1 });
        const aliceRows = (await request(app).get('/api/transactions').set(auth(alice.token))).body.data;
        const bobRows = (await request(app).get('/api/transactions').set(auth(bob.token))).body.data;
        expect(aliceRows).toHaveLength(4);
        expect(bobRows).toHaveLength(4);
        const aliceIds = new Set(aliceRows.map((t) => t.id));
        expect(bobRows.some((t) => aliceIds.has(t.id))).toBe(false);
        expect((await request(app).get(`/api/transactions/${aliceRows[0].id}`).set(auth(bob.token))).status).toBe(404);
    });

    test('import validates the envelope', async () => {
        const { token } = await signup();
        const post = (body) => request(app).post('/api/transactions/import').set(auth(token)).send(body);
        expect((await post({ fileName: 'a.csv', rows: [] })).status).toBe(400);
        expect((await post({ rows: importRows() })).status).toBe(400);
        expect((await post({ fileName: 'a.csv', rows: new Array(2001).fill(importRows()[0]) })).status).toBe(400);
    });

    test('categories lists used categories, most used first, only for the caller', async () => {
        const alice = await signup('Alice');
        const bob = await signup('Bob');
        await doImport(alice.token);
        await request(app).post('/api/transactions').set(auth(bob.token)).send(tx({ category: 'Bobs Secret' }));
        const res = await request(app).get('/api/transactions/categories').set(auth(alice.token));
        expect(res.status).toBe(200);
        expect(res.body.data).toEqual([
            { category: 'Food', type: 'expense', count: 2 },
            { category: 'Salary', type: 'income', count: 1 },
            { category: 'Travel', type: 'expense', count: 1 },
        ]);
    });

    test('export.csv returns escaped CSV for the date range', async () => {
        const { token } = await signup();
        await doImport(token);
        await request(app).post('/api/transactions').set(auth(token)).send(tx({ description: '=HYPERLINK("http://evil")', date: `${daysAgo(1)}T12:00:00Z` }));
        const res = await request(app).get('/api/transactions/export.csv').query({ startDate: daysAgo(8), endDate: daysAgo(0) }).set(auth(token));
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/^text\/csv/);
        expect(res.headers['content-disposition']).toMatch(/^attachment; filename="fintrack-\d{4}-\d{2}-\d{2}\.csv"$/);
        const lines = res.text.trim().split('\r\n');
        expect(lines[0]).toBe('date,type,category,description,amount,payment_method,notes,source');
        expect(lines).toHaveLength(4); // header + Metro card, Lunch and the manual row (older rows filtered out)
        expect(res.text).toContain(`${daysAgo(1)},expense,Food,"'=HYPERLINK(""http://evil"")",450.00,other,,manual`);
        expect(res.text).toContain(`${daysAgo(8)},expense,Travel,Metro card,300.00,card,monthly,import`);
        expect(res.text).not.toContain('Salary');
    });
});

maybe('account settings', () => {
    test('preferences round trip through /me', async () => {
        const { token } = await signup('Teja');
        const prefs = {
            theme: 'dark',
            currency: 'EUR',
            notifications: false,
            month_start_day: 25,
            date_format: 'YYYY-MM-DD',
            week_start: 'sunday',
            monthly_income_target: 75000.5,
            budget_alerts: false,
        };
        const put = await request(app).put('/api/auth/preferences').set(auth(token)).send({ ...prefs, name: 'Teja M', id: 'x' });
        expect(put.status).toBe(200);
        expect(put.body.preferences).toEqual(prefs);
        const me = await request(app).get('/api/auth/me').set(auth(token));
        expect(me.body.data).toMatchObject({ name: 'Teja M', preferences: prefs });

        const cleared = await request(app).put('/api/auth/preferences').set(auth(token)).send({ monthly_income_target: null });
        expect(cleared.body.preferences.monthly_income_target).toBeNull();
        for (const bad of [{ month_start_day: 29 }, { currency: 'XYZ' }, { date_format: 'DD-MM' }, { week_start: 'friday' }, { name: 'R2D2' }]) {
            expect((await request(app).put('/api/auth/preferences').set(auth(token)).send(bad)).status).toBe(400);
        }
    });

    test('password change verifies the current password', async () => {
        const { token, email } = await signup();
        const change = (body) => request(app).post('/api/auth/password').set(auth(token)).send(body);
        expect((await change({ currentPassword: 'Wrong1234', newPassword: 'NewPassw0rd' })).status).toBe(401);
        expect((await change({ currentPassword: PASSWORD, newPassword: 'weak' })).status).toBe(400);
        const ok = await change({ currentPassword: PASSWORD, newPassword: 'NewPassw0rd' });
        expect(ok.status).toBe(200);
        expect((await request(app).post('/api/auth/login').send({ email, password: PASSWORD })).status).toBe(401);
        expect((await request(app).post('/api/auth/login').send({ email, password: 'NewPassw0rd' })).status).toBe(200);
        // The caller's own session keeps working.
        expect((await request(app).get('/api/auth/me').set(auth(token))).status).toBe(200);
    });

    test('account deletion removes the user and all their data', async () => {
        const { token, email } = await signup();
        const other = await signup('Other');
        await request(app).post('/api/transactions').set(auth(other.token)).send(tx());
        await doImport(token);
        await request(app).post('/api/budgets').set(auth(token)).send({ category: 'Food', limit: 100 });

        expect((await request(app).delete('/api/auth/account').set(auth(token)).send({})).status).toBe(400);
        expect((await request(app).delete('/api/auth/account').set(auth(token)).send({ confirm: 'DELETE' })).status).toBe(200);

        expect((await request(app).get('/api/auth/me').set(auth(token))).status).toBe(401);
        expect((await request(app).post('/api/auth/login').send({ email, password: PASSWORD })).status).toBe(401);

        // The email is free again and the new account starts empty.
        const again = await request(app).post('/api/auth/register').send({ name: 'Again', email, password: PASSWORD });
        expect(again.status).toBe(201);
        expect((await request(app).get('/api/transactions').set(auth(again.body.token))).body.data).toHaveLength(0);
        expect((await request(app).get('/api/budgets').set(auth(again.body.token))).body).toHaveLength(0);
        // Other users are untouched.
        expect((await request(app).get('/api/transactions').set(auth(other.token))).body.data).toHaveLength(1);
    });
});
