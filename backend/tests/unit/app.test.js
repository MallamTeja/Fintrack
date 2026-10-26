// HTTP behaviour that needs no database.
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:1';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'unit-test-placeholder';

const request = require('supertest');
const app = require('../../src/app');

test('health is public', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
});

test('security headers are set and x-powered-by is hidden', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
});

test.each(['/api/transactions', '/api/budgets', '/api/savings-goals', '/api/auth/me'])(
    '%s requires a bearer token',
    async (path) => {
        const res = await request(app).get(path);
        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
    }
);

test('unknown API routes return JSON 404', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.type).toMatch(/json/);
});

test('malformed JSON is a 400, not a crash', async () => {
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{bad');
    expect(res.status).toBe(400);
});

test('register validates before calling Supabase', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'x', password: 'y' });
    expect(res.status).toBe(400);
});

test('public config exposes only the URL and anon key', async () => {
    const res = await request(app).get('/api/config');
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(['supabaseAnonKey', 'supabaseUrl']);
});

test.each([
    ['get', '/api/transactions/categories'],
    ['get', '/api/transactions/export.csv'],
    ['post', '/api/transactions/import'],
    ['post', '/api/auth/password'],
    ['delete', '/api/auth/account'],
])('%s %s requires a bearer token', async (method, path) => {
    const res = await request(app)[method](path).send({});
    expect(res.status).toBe(401);
});

test('JSON bodies are capped at 50kb', async () => {
    const res = await request(app)
        .post('/api/transactions')
        .send({ description: 'x'.repeat(60 * 1024) });
    expect(res.status).toBe(413);
});

test('the import route is exempt from the 50kb cap (it parses up to 1mb after auth)', async () => {
    const res = await request(app)
        .post('/api/transactions/import')
        .send({ fileName: 'a.csv', rows: [{ description: 'x'.repeat(200 * 1024) }] });
    expect(res.status).toBe(401); // reached auth instead of failing with 413
});
