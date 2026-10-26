// Rate limits are off under NODE_ENV=test; load the app as production to check them.
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:1';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'unit-test-placeholder';

const request = require('supertest');

let app;
beforeAll(() => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    jest.isolateModules(() => {
        app = require('../../src/app');
    });
    process.env.NODE_ENV = prev;
});

test('import is limited to 10 requests per 15 minutes per IP', async () => {
    const statuses = [];
    for (let i = 0; i < 11; i += 1) {
        statuses.push((await request(app).post('/api/transactions/import').send({})).status);
    }
    expect(statuses.slice(0, 10)).toEqual(new Array(10).fill(401));
    expect(statuses[10]).toBe(429);
    // Other routes are not affected by the import limit.
    expect((await request(app).get('/api/health')).status).toBe(200);
});
