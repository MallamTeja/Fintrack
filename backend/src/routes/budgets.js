// /api/budgets: one monthly limit per category, returned with this month's spending.
const express = require('express');
const { requireAuth } = require('../auth');
const { HttpError, asyncHandler, fromDbError } = require('../http');
const { isUuid, parseBudget } = require('../validate');

const router = express.Router();
router.use(requireAuth);

const COLUMNS = 'id, category, limit_amount, created_at, updated_at';
const NOT_FOUND = 'Budget not found';
const toApi = (row, spent) => ({
    id: row.id,
    _id: row.id,
    category: row.category,
    limit: Number(row.limit_amount),
    ...(spent !== undefined ? { current_spending: spent } : {}),
    created_at: row.created_at,
    updated_at: row.updated_at,
});

function checkId(req) {
    if (!isUuid(req.params.id)) throw new HttpError(404, NOT_FOUND);
}

router.get('/', asyncHandler(async (req, res) => {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const [budgets, spending] = await Promise.all([
        req.db.from('budgets').select(COLUMNS).order('category'),
        req.db.from('transactions').select('category, amount').eq('type', 'expense').gte('date', monthStart),
    ]);
    if (budgets.error) throw fromDbError(budgets.error);
    if (spending.error) throw fromDbError(spending.error);

    const spent = {};
    for (const t of spending.data) spent[t.category] = (spent[t.category] || 0) + Number(t.amount);
    res.json(budgets.data.map((b) => toApi(b, Math.round((spent[b.category] || 0) * 100) / 100)));
}));

router.post('/', asyncHandler(async (req, res) => {
    const row = parseBudget(req.body);
    const { data, error } = await req.db.from('budgets').insert(row).select(COLUMNS).single();
    if (error?.code === '23505') throw new HttpError(409, 'A budget for this category already exists');
    if (error) throw fromDbError(error);
    res.status(201).json(toApi(data));
}));

const update = asyncHandler(async (req, res) => {
    checkId(req);
    const changes = parseBudget(req.body, true);
    const { data, error } = await req.db.from('budgets').update(changes).eq('id', req.params.id).select(COLUMNS).single();
    if (error) throw fromDbError(error, NOT_FOUND);
    res.json(toApi(data));
});
router.put('/:id', update);
router.patch('/:id', update);

router.delete('/:id', asyncHandler(async (req, res) => {
    checkId(req);
    const { data, error } = await req.db.from('budgets').delete().eq('id', req.params.id).select('id');
    if (error) throw fromDbError(error);
    if (!data.length) throw new HttpError(404, NOT_FOUND);
    res.json({ success: true, message: 'Budget deleted' });
}));

module.exports = router;
