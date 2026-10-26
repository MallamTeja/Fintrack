const crypto = require('crypto');
const { normalizeDescription, importHash, prepareImport, csvCell, toCsv, EXPORT_COLUMNS } = require('../../src/csv');

const sha = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');
const row = (over = {}) => ({ date: '2026-10-01', description: 'Coffee', amount: 120.5, type: 'expense', category: 'Food', ...over });

describe('import hash', () => {
    test('normalizeDescription lowercases and collapses whitespace', () => {
        expect(normalizeDescription('  Swiggy   ORDER\t#12\n ')).toBe('swiggy order #12');
        expect(normalizeDescription('')).toBe('');
        expect(normalizeDescription(undefined)).toBe('');
    });

    test('is sha256 of date|type|amount(2dp)|normalized description', () => {
        const h = importHash({ date: '2026-10-01T00:00:00.000Z', type: 'expense', amount: 120.5, description: '  Swiggy  Order ' });
        expect(h).toBe(sha('2026-10-01|expense|120.50|swiggy order'));
        expect(h).toMatch(/^[0-9a-f]{64}$/);
    });

    test('same day, amount and text in different spelling gives the same hash', () => {
        const a = importHash({ date: '2026-10-01T00:00:00.000Z', type: 'expense', amount: 120.5, description: 'Swiggy Order' });
        const b = importHash({ date: '2026-10-01T18:45:00.000Z', type: 'expense', amount: 120.50, description: ' swiggy   order' });
        expect(a).toBe(b);
    });

    test('type, amount, day and text all matter', () => {
        const base = { date: '2026-10-01T00:00:00.000Z', type: 'expense', amount: 10, description: 'x' };
        const h = importHash(base);
        expect(importHash({ ...base, type: 'income' })).not.toBe(h);
        expect(importHash({ ...base, amount: 10.01 })).not.toBe(h);
        expect(importHash({ ...base, date: '2026-10-02T00:00:00.000Z' })).not.toBe(h);
        expect(importHash({ ...base, description: 'y' })).not.toBe(h);
    });
});

describe('prepareImport', () => {
    test('validates, fingerprints and dedupes within the batch', () => {
        const out = prepareImport([
            row(),
            row({ description: '  COFFEE ', amount: '120.50' }), // same fingerprint as row 0
            row({ amount: -1 }),
            'not an object',
            row({ type: 'income', category: 'Salary', amount: 5000, description: undefined, payment_method: 'bank', notes: 'Oct' }),
            row({ import_hash: 'f'.repeat(64), source: 'manual', user_id: 'someone', description: 'Tea' }),
        ]);
        expect(out.duplicates).toBe(1);
        expect(out.invalid).toEqual([
            { index: 2, errors: ['amount must be greater than 0'] },
            { index: 3, errors: ['Expected a JSON object'] },
        ]);
        expect(out.rows).toHaveLength(3);
        for (const r of out.rows) {
            expect(Object.keys(r).sort()).toEqual(
                ['amount', 'category', 'date', 'description', 'import_hash', 'notes', 'payment_method', 'source', 'type'].sort()
            );
            expect(r.source).toBe('import');
            expect(r.import_hash).toBe(importHash(r));
        }
        expect(out.rows[0]).toMatchObject({ description: 'Coffee', notes: '', payment_method: 'other', date: '2026-10-01T00:00:00.000Z' });
        expect(out.rows[1]).toMatchObject({ description: '', notes: 'Oct', payment_method: 'bank' });
        expect(out.rows[2].import_hash).not.toBe('f'.repeat(64)); // client hash ignored
        expect(out.rows[2]).not.toHaveProperty('user_id');
    });
});

describe('CSV export', () => {
    test.each([
        ['=SUM(A1:A9)', "'=SUM(A1:A9)"],
        ['+91 98', "'+91 98"],
        ['-5', "'-5"],
        ['@cmd', "'@cmd"],
        ['\tx', "'\tx"],
        ['plain', 'plain'],
        ['a=b', 'a=b'],
        ['', ''],
        [null, ''],
        [undefined, ''],
        ['has,comma', '"has,comma"'],
        ['say "hi"', '"say ""hi"""'],
        ['two\nlines', '"two\nlines"'],
        ['=1,2', '"\'=1,2"'],
    ])('cell %j -> %j', (input, expected) => {
        expect(csvCell(input)).toBe(expected);
    });

    test('toCsv writes the header and one escaped line per row', () => {
        const csv = toCsv([
            {
                date: '2026-10-01T18:30:00+00:00',
                type: 'expense',
                category: 'Food',
                description: '=HYPERLINK("http://x")',
                amount: '1200',
                payment_method: 'upi',
                notes: 'a, b',
                source: 'import',
            },
        ]);
        const lines = csv.split('\r\n');
        expect(lines[0]).toBe(EXPORT_COLUMNS.join(','));
        expect(lines[0]).toBe('date,type,category,description,amount,payment_method,notes,source');
        expect(lines[1]).toBe('2026-10-01,expense,Food,"\'=HYPERLINK(""http://x"")",1200.00,upi,"a, b",import');
        expect(lines[2]).toBe('');
        expect(toCsv([])).toBe('date,type,category,description,amount,payment_method,notes,source\r\n');
    });
});
