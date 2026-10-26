// /api/savings-goals (also /api/savings): CRUD on the user's savings goals.
const express = require('express');
const { requireAuth } = require('../auth');
const { HttpError, asyncHandler, fromDbError } = require('../http');
const { isUuid, parseSavingsGoal, checkGoalAmounts } = require('../validate');

const router = express.Router();
router.use(requireAuth);

const COLUMNS = 'id, title, target_amount, current_amount, category, due_date, created_at, updated_at';
const NOT_FOUND = 'Savings goal not found';
const toApi = (row) => ({
    ...row,
    _id: row.id,
    target_amount: Number(row.target_amount),
    current_amount: Number(row.current_amount),
});

function checkId(req) {
    if (!isUuid(req.params.id)) throw new HttpError(404, NOT_FOUND);
}

router.get('/', asyncHandler(async (req, res) => {
    const { data, error } = await req.db
        .from('savings_goals')
        .select(COLUMNS)
        .order('due_date', { ascending: true, nullsFirst: false });
    if (error) throw fromDbError(error);
    res.json(data.map(toApi));
}));

router.post('/', asyncHandler(async (req, res) => {
    const row = parseSavingsGoal(req.body);
    const { data, error } = await req.db.from('savings_goals').insert(row).select(COLUMNS).single();
    if (error) throw fromDbError(error);
    res.status(201).json(toApi(data));
}));

const update = asyncHandler(async (req, res) => {
    checkId(req);
    const changes = parseSavingsGoal(req.body, true);
    // current_amount may be at most 10x target_amount: fill in whichever side is not being changed.
    const hasTarget = changes.target_amount !== undefined;
    const hasCurrent = changes.current_amount !== undefined;
    if (hasTarget !== hasCurrent) {
        const { data: goal, error } = await req.db
            .from('savings_goals')
            .select('target_amount, current_amount')
            .eq('id', req.params.id)
            .single();
        if (error) throw fromDbError(error, NOT_FOUND);
        checkGoalAmounts(
            hasTarget ? changes.target_amount : goal.target_amount,
            hasCurrent ? changes.current_amount : goal.current_amount
        );
    }
    const { data, error } = await req.db
        .from('savings_goals')
        .update(changes)
        .eq('id', req.params.id)
        .select(COLUMNS)
        .single();
    if (error) throw fromDbError(error, NOT_FOUND);
    res.json(toApi(data));
});
router.put('/:id', update);
router.patch('/:id', update);

router.delete('/:id', asyncHandler(async (req, res) => {
    checkId(req);
    const { data, error } = await req.db.from('savings_goals').delete().eq('id', req.params.id).select(COLUMNS);
    if (error) throw fromDbError(error);
    if (!data.length) throw new HttpError(404, NOT_FOUND);
    res.json(toApi(data[0]));
}));

module.exports = router;
