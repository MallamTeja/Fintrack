const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { check, validationResult } = require('express-validator');

const Transaction = require('../models/Transaction');

// @route   GET api/transactions
// @desc    Get all transactions
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const transactions = await Transaction.find({ user: req.user.id }).sort({ date: -1 });
        res.json(transactions);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   POST api/transactions
// @desc    Add new transaction
// @access  Private
router.post('/', [
    auth,
    check('description', 'Description is required').not().isEmpty(),
    check('amount', 'Amount is required').not().isEmpty(),
    check('type', 'Type must be either income or expense').isIn(['income', 'expense']),
    check('category', 'Category is required').not().isEmpty(),
    check('date', 'Date is required').not().isEmpty()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { description, amount, type, category, date } = req.body;
        const newTransaction = new Transaction({
            description,
            amount,
            type,
            category,
            date,
            user: req.user.id
        });

        const transaction = await newTransaction.save();

        // Broadcast to user's WebSocket connections
        req.app.locals.wss.broadcastToUser(req.user.id, {
            type: 'transaction_added',
            payload: transaction
        });

        res.json(transaction);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   PUT api/transactions/:id
// @desc    Update transaction
// @access  Private
router.put('/:id', [
    auth,
    check('description', 'Description is required').not().isEmpty(),
    check('amount', 'Amount is required').not().isEmpty(),
    check('type', 'Type must be either income or expense').isIn(['income', 'expense']),
    check('category', 'Category is required').not().isEmpty(),
    check('date', 'Date is required').not().isEmpty()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        let transaction = await Transaction.findById(req.params.id);
        if (!transaction) return res.status(404).json({ msg: 'Transaction not found' });

        // Make sure user owns transaction
        if (transaction.user.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        const { description, amount, type, category, date } = req.body;
        transaction = await Transaction.findByIdAndUpdate(
            req.params.id,
            { $set: { description, amount, type, category, date } },
            { new: true }
        );

        // Broadcast to user's WebSocket connections
        req.app.locals.wss.broadcastToUser(req.user.id, {
            type: 'transaction_updated',
            payload: transaction
        });

        res.json(transaction);
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({ msg: 'Transaction not found' });
        }
        res.status(500).send('Server error');
    }
});

// @route   DELETE api/transactions/:id
// @desc    Delete transaction
// @access  Private
router.delete('/:id', auth, async (req, res) => {
    try {
        const transaction = await Transaction.findById(req.params.id);
        if (!transaction) return res.status(404).json({ msg: 'Transaction not found' });
        if (!transaction) {
            return res.status(404).json({ msg: 'Transaction not found' });
        }

        // Make sure user owns transaction
        if (transaction.user.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        await transaction.remove();
        res.json({ msg: 'Transaction removed' });
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({ msg: 'Transaction not found' });
        }
        res.status(500).send('Server error');
    }
});

// @route   PUT api/transactions/:id
// @desc    Update a transaction
// @access  Private
router.put('/:id', auth, async (req, res) => {
    try {
        const { description, amount, type, category, date } = req.body;
        const transaction = await Transaction.findById(req.params.id);

        if (!transaction) {
            return res.status(404).json({ msg: 'Transaction not found' });
        }

        // Make sure user owns transaction
        if (transaction.user.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        transaction.description = description || transaction.description;
        transaction.amount = amount || transaction.amount;
        transaction.type = type || transaction.type;
        transaction.category = category || transaction.category;
        transaction.date = date || transaction.date;

        await transaction.save();
        res.json(transaction);
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({ msg: 'Transaction not found' });
        }
        res.status(500).send('Server error');
    }
});

module.exports = router; 