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
        for (const bad of [tx({ amount: -1 }), tx({ type: 'gift' }), tx({ date: 'nope' }), tx({ description: '' })]) {
            expect((await request(app).post('/api/transactions').set(auth(token)).send(bad)).status).toBe(400);
        }
        expect((await request(app).get('/api/transactions/not-a-uuid').set(auth(token))).status).toBe(404);
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
    const goal = { title: 'Laptop', target_amount: 80000, current_amount: 5000, category: 'Tech', due_date: '2027-06-01' };

    test('CRUD on both /api/savings-goals and /api/savings', async () => {
        const { token } = await signup();
        const created = await request(app).post('/api/savings-goals').set(auth(token)).send(goal);
        expect(created.status).toBe(201);
        const id = created.body._id;
        expect((await request(app).get('/api/savings').set(auth(token))).body).toHaveLength(1);
        expect((await request(app).patch(`/api/savings/${id}`).set(auth(token)).send({ current_amount: 9000 })).body.current_amount).toBe(9000);
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
