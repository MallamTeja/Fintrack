// /api/transactions: rows are filtered by RLS, so queries never need a user_id filter for safety.
const express = require('express');
const { requireAuth } = require('../auth');
const { HttpError, asyncHandler, fromDbError } = require('../http');
const { isUuid, parseTransaction, parseTransactionQuery, parseImportBody } = require('../validate');
const { prepareImport, toCsv } = require('../csv');

const router = express.Router();
router.use(requireAuth);

const COLUMNS = 'id, type, category, amount, description, notes, payment_method, source, payee_key, date, created_at, updated_at';
const toApi = (row) => ({ ...row, _id: row.id, amount: Number(row.amount) });
const NOT_FOUND = 'Transaction not found';
// PostgREST returns at most this many rows per request (Supabase default max_rows).
const PAGE_SIZE = 1000;
const MAX_SCAN = 100_000;

function checkId(req) {
    if (!isUuid(req.params.id)) throw new HttpError(404, NOT_FOUND);
}

/**
 * LIKE pattern that matches user text literally: \ % _ are escaped. PostgREST turns
 * `*` into `%`, so a literal `*` becomes the single-character wildcard `_` instead.
 */
const likePattern = (s) => `%${s.replace(/[\\%_]/g, '\\$&').replace(/\*/g, '_')}%`;
/** Double-quoted value for a PostgREST logic tree (`or=(...)`): escapes \ and ". */
const quoted = (s) => `"${s.replace(/["\\]/g, '\\$&')}"`;

function applyFilters(query, f) {
    if (f.type) query = query.eq('type', f.type);
    if (f.source) query = query.eq('source', f.source);
    if (f.payment_method) query = query.eq('payment_method', f.payment_method);
    if (f.category) query = query.ilike('category', likePattern(f.category));
    if (f.q) {
        const p = quoted(likePattern(f.q));
        query = query.or(`description.ilike.${p},category.ilike.${p}`);
    }
    if (f.startDate) query = query.gte('date', f.startDate);
    if (f.endDate) query = query.lte('date', f.endDate);
    return query;
}

/** Reads every matching row in pages of PAGE_SIZE (stable order by date, then id). */
async function fetchAll(makeQuery) {
    const out = [];
    for (let from = 0; from < MAX_SCAN; from += PAGE_SIZE) {
        const { data, error } = await makeQuery()
            .order('date', { ascending: false })
            .order('id', { ascending: true })
            .range(from, from + PAGE_SIZE - 1);
        if (error) throw fromDbError(error);
        out.push(...data);
        if (data.length < PAGE_SIZE) break;
    }
    return out;
}

router.get('/', asyncHandler(async (req, res) => {
    const f = parseTransactionQuery(req.query);
    const from = (f.page - 1) * f.limit;
    const query = applyFilters(req.db.from('transactions').select(COLUMNS, { count: 'exact' }), f)
        .order('date', { ascending: false })
        .order('id', { ascending: true })
        .range(from, from + f.limit - 1);
    const { data, count, error } = await query;
    if (error) {
        // Asking for a page past the end is not an error, just an empty page.
        if (error.code === 'PGRST103') {
            const head = await applyFilters(req.db.from('transactions').select('id', { count: 'exact', head: true }), f);
            if (head.error) throw fromDbError(head.error);
            const total = head.count || 0;
            return res.json({
                success: true,
                data: [],
                pagination: { page: f.page, limit: f.limit, total, totalPages: Math.ceil(total / f.limit) },
            });
        }
        throw fromDbError(error);
    }
    res.json({
        success: true,
        data: data.map(toApi),
        pagination: { page: f.page, limit: f.limit, total: count, totalPages: Math.ceil((count || 0) / f.limit) },
    });
}));

router.get('/stats/summary', asyncHandler(async (req, res) => {
    const f = parseTransactionQuery(req.query);
    const rows = await fetchAll(() => applyFilters(req.db.from('transactions').select('type, category, amount'), f));
    const summary = { income: 0, expense: 0, balance: 0, count: rows.length, byCategory: {} };
    for (const t of rows) {
        const amount = Number(t.amount);
        summary[t.type] += amount;
        const key = `${t.type}:${t.category}`;
        summary.byCategory[key] = (summary.byCategory[key] || 0) + amount;
    }
    const round = (n) => Math.round(n * 100) / 100;
    summary.income = round(summary.income);
    summary.expense = round(summary.expense);
    for (const k of Object.keys(summary.byCategory)) summary.byCategory[k] = round(summary.byCategory[k]);
    summary.balance = round(summary.income - summary.expense);
    res.json({ success: true, data: summary });
}));

// Distinct (category, type) pairs the user has used, most used first.
router.get('/categories', asyncHandler(async (req, res) => {
    const rows = await fetchAll(() => req.db.from('transactions').select('category, type'));
    const counts = new Map();
    for (const { category, type } of rows) {
        const key = `${type}\u0000${category}`;
        const entry = counts.get(key) || { category, type, count: 0 };
        entry.count += 1;
        counts.set(key, entry);
    }
    const data = [...counts.values()].sort(
        (a, b) => b.count - a.count || a.category.localeCompare(b.category) || a.type.localeCompare(b.type)
    );
    res.json({ success: true, data });
}));

router.get('/export.csv', asyncHandler(async (req, res) => {
    const f = parseTransactionQuery(req.query);
    const rows = await fetchAll(() =>
        applyFilters(
            req.db.from('transactions').select('date, type, category, description, amount, payment_method, notes, source'),
            f
        )
    );
    const today = new Date().toISOString().slice(0, 10);
    res.set({
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="fintrack-${today}.csv"`,
        'Cache-Control': 'no-store',
    });
    res.send(toCsv(rows));
}));

// Bulk import (CSV parsed by the client). Body limit is 1mb for this route only (see app.js).
router.post('/import', express.json({ limit: '1mb' }), asyncHandler(async (req, res) => {
    const { rows: rawRows } = parseImportBody(req.body);
    const { rows, invalid, duplicates: batchDuplicates } = prepareImport(rawRows);

    // Rows already imported earlier (same fingerprint). Chunked to keep URLs short.
    const existing = new Set();
    const hashes = rows.map((r) => r.import_hash);
    for (let i = 0; i < hashes.length; i += 100) {
        const { data, error } = await req.db
            .from('transactions')
            .select('import_hash')
            .in('import_hash', hashes.slice(i, i + 100));
        if (error) throw fromDbError(error);
        for (const r of data) existing.add(r.import_hash);
    }
    const fresh = rows.filter((r) => !existing.has(r.import_hash));

    // Names the user gave a payee win over the name read from the statement.
    const keys = [...new Set(fresh.map((r) => r.payee_key).filter(Boolean))];
    const names = new Map();
    for (let i = 0; i < keys.length; i += 100) {
        const { data, error } = await req.db.from('payees').select('key, name').in('key', keys.slice(i, i + 100));
        if (error) throw fromDbError(error);
        for (const p of data) names.set(p.key, p.name);
    }
    for (const r of fresh) if (names.has(r.payee_key)) r.description = names.get(r.payee_key);

    let inserted = 0;
    if (fresh.length) {
        const { error } = await req.db.from('transactions').insert(fresh, { defaultToNull: false });
        if (!error) inserted = fresh.length;
        else if (error.code === '23505') {
            // A concurrent import won the race for some rows: insert one by one, skipping those.
            for (const row of fresh) {
                const one = await req.db.from('transactions').insert(row);
                if (!one.error) inserted += 1;
                else if (one.error.code !== '23505') throw fromDbError(one.error);
            }
        } else throw fromDbError(error);
    }

    res.json({
        success: true,
        data: {
            received: rawRows.length,
            inserted,
            duplicates: batchDuplicates + (rows.length - inserted),
            invalid,
        },
    });
}));

router.get('/:id', asyncHandler(async (req, res) => {
    checkId(req);
    const { data, error } = await req.db.from('transactions').select(COLUMNS).eq('id', req.params.id).single();
    if (error) throw fromDbError(error, NOT_FOUND);
    res.json({ success: true, data: toApi(data) });
}));

router.post('/', asyncHandler(async (req, res) => {
    const row = parseTransaction(req.body);
    const { data, error } = await req.db.from('transactions').insert(row).select(COLUMNS).single();
    if (error) throw fromDbError(error);
    res.status(201).json({ success: true, data: toApi(data) });
}));

const update = asyncHandler(async (req, res) => {
    checkId(req);
    const changes = parseTransaction(req.body, req.method === 'PATCH');
    const { data, error } = await req.db
        .from('transactions')
        .update(changes)
        .eq('id', req.params.id)
        .select(COLUMNS)
        .single();
    if (error) throw fromDbError(error, NOT_FOUND);
    res.json({ success: true, data: toApi(data) });
});
router.put('/:id', update);
router.patch('/:id', update);

router.delete('/:id', asyncHandler(async (req, res) => {
    checkId(req);
    const { data, error } = await req.db.from('transactions').delete().eq('id', req.params.id).select('id');
    if (error) throw fromDbError(error);
    if (!data.length) throw new HttpError(404, NOT_FOUND);
    res.json({ success: true, message: 'Transaction deleted' });
}));

module.exports = router;
