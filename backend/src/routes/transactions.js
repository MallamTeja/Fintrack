// /api/transactions: rows are filtered by RLS, so queries never need a user_id filter for safety.
const express = require('express');
const { requireAuth } = require('../auth');
const { HttpError, asyncHandler, fromDbError } = require('../http');
const { isUuid, parseTransaction } = require('../validate');

const router = express.Router();
router.use(requireAuth);

const COLUMNS = 'id, type, category, amount, description, date, created_at, updated_at';
const toApi = (row) => ({ ...row, _id: row.id, amount: Number(row.amount) });
const NOT_FOUND = 'Transaction not found';

function checkId(req) {
    if (!isUuid(req.params.id)) throw new HttpError(404, NOT_FOUND);
}

function applyFilters(query, q) {
    if (q.type === 'income' || q.type === 'expense') query = query.eq('type', q.type);
    // ilike with escaped wildcards: user text is matched literally, never as a pattern.
    if (typeof q.category === 'string' && q.category.trim()) {
        query = query.ilike('category', `%${q.category.trim().replace(/[\\%_]/g, '\\$&')}%`);
    }
    for (const [key, op] of [['startDate', 'gte'], ['endDate', 'lte']]) {
        if (q[key] === undefined) continue;
        const d = new Date(q[key]);
        if (Number.isNaN(d.getTime())) throw new HttpError(400, `${key} must be a valid date`);
        query = query[op]('date', d.toISOString());
    }
    return query;
}

router.get('/', asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 100));
    const from = (page - 1) * limit;

    const query = applyFilters(req.db.from('transactions').select(COLUMNS, { count: 'exact' }), req.query)
        .order('date', { ascending: false })
        .range(from, from + limit - 1);
    const { data, count, error } = await query;
    if (error) throw fromDbError(error);
    res.json({
        success: true,
        data: data.map(toApi),
        pagination: { page, limit, total: count, totalPages: Math.ceil((count || 0) / limit) },
    });
}));

router.get('/stats/summary', asyncHandler(async (req, res) => {
    const { data, error } = await applyFilters(req.db.from('transactions').select('type, category, amount'), req.query);
    if (error) throw fromDbError(error);
    const summary = { income: 0, expense: 0, balance: 0, count: data.length, byCategory: {} };
    for (const t of data) {
        const amount = Number(t.amount);
        summary[t.type] += amount;
        const key = `${t.type}:${t.category}`;
        summary.byCategory[key] = (summary.byCategory[key] || 0) + amount;
    }
    summary.balance = Math.round((summary.income - summary.expense) * 100) / 100;
    res.json({ success: true, data: summary });
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
