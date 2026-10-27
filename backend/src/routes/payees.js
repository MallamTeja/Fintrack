// /api/payees: people and businesses that money moves to and from, built from the
// payee_key on each transaction, plus the names the user chose for them.
const express = require('express');
const { requireAuth } = require('../auth');
const { asyncHandler, fromDbError, HttpError } = require('../http');
const { parsePayee, parsePayeeKey } = require('../validate');

const router = express.Router();
router.use(requireAuth);

const PAGE_SIZE = 1000;
const MAX_SCAN = 100_000;
const TX_COLUMNS = 'id, type, category, amount, description, notes, payment_method, source, payee_key, date';
const UPI_ID_RE = /[A-Za-z0-9._-]+@[A-Za-z][A-Za-z0-9.]*/;
const round = (n) => Math.round(n * 100) / 100;

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

async function savedNames(db, keys) {
    const names = new Map();
    for (let i = 0; i < keys.length; i += 100) {
        const { data, error } = await db.from('payees').select('key, name').in('key', keys.slice(i, i + 100));
        if (error) throw fromDbError(error);
        for (const p of data) names.set(p.key, p.name);
    }
    return names;
}

/** Summary for one payee from its transactions (newest first) and the saved name, if any. */
function summarise(key, rows, savedName) {
    const s = {
        key,
        name: savedName || rows.find((r) => r.description)?.description || key.replace(/^(upi|name):/, ''),
        named: Boolean(savedName),
        upi_id: '',
        count: rows.length,
        received: 0,
        paid: 0,
        first_date: rows.length ? rows[rows.length - 1].date : null,
        last_date: rows.length ? rows[0].date : null,
    };
    for (const r of rows) {
        if (r.type === 'income') s.received += Number(r.amount);
        else s.paid += Number(r.amount);
        if (!s.upi_id && key.startsWith('upi:')) {
            const m = String(r.notes || '').match(UPI_ID_RE);
            if (m && m[0].toLowerCase().startsWith(key.slice(4))) s.upi_id = m[0];
        }
    }
    s.received = round(s.received);
    s.paid = round(s.paid);
    return s;
}

router.get('/', asyncHandler(async (req, res) => {
    const rows = await fetchAll(() =>
        req.db.from('transactions').select('payee_key, description, notes, type, amount, date').not('payee_key', 'is', null)
    );
    const groups = new Map();
    for (const r of rows) {
        if (!groups.has(r.payee_key)) groups.set(r.payee_key, []);
        groups.get(r.payee_key).push(r);
    }
    const names = await savedNames(req.db, [...groups.keys()]);
    const data = [...groups.entries()]
        .map(([key, list]) => summarise(key, list, names.get(key)))
        .sort((a, b) => String(b.last_date).localeCompare(String(a.last_date)) || a.name.localeCompare(b.name));
    res.json({ success: true, data });
}));

router.get('/detail', asyncHandler(async (req, res) => {
    const key = parsePayeeKey(req.query.key);
    const rows = await fetchAll(() => req.db.from('transactions').select(TX_COLUMNS).eq('payee_key', key));
    if (!rows.length) throw new HttpError(404, 'No transactions for this payee');
    const names = await savedNames(req.db, [key]);
    res.json({
        success: true,
        data: {
            payee: summarise(key, rows, names.get(key)),
            transactions: rows.map((r) => ({ ...r, _id: r.id, amount: Number(r.amount) })),
        },
    });
}));

// Save a name for a payee and rename all of its transactions.
router.put('/', asyncHandler(async (req, res) => {
    const { key, name } = parsePayee(req.body);
    let saved = await req.db.from('payees').update({ name }).eq('key', key).select('key, name');
    if (saved.error) throw fromDbError(saved.error);
    if (!saved.data.length) {
        saved = await req.db.from('payees').insert({ key, name }).select('key, name');
        // 23505: saved by a parallel request a moment ago; this name wins.
        if (saved.error?.code === '23505') saved = await req.db.from('payees').update({ name }).eq('key', key).select('key, name');
        if (saved.error) throw fromDbError(saved.error);
    }
    const { data, error } = await req.db.from('transactions').update({ description: name }).eq('payee_key', key).select('id');
    if (error) throw fromDbError(error);
    res.json({ success: true, data: { key, name: saved.data[0]?.name ?? name, updated: data.length } });
}));

// Forget a saved name. Transactions keep their current description.
router.delete('/', asyncHandler(async (req, res) => {
    const key = parsePayeeKey(req.body?.key ?? req.query.key);
    const { error } = await req.db.from('payees').delete().eq('key', key);
    if (error) throw fromDbError(error);
    res.json({ success: true, message: 'Saved name removed' });
}));

module.exports = router;
