const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');
const { broadcastToUser } = require('../websocketManager');

// Get all transactions for authenticated user
router.get('/', auth, async (req, res) => {
    try {
        const transactions = await Transaction.find({ user: req.user._id }).sort({ date: -1 });
        res.json(transactions);
    } catch (error) {
        console.error('Error getting transactions:', error);
        res.status(500).json({ error: 'Failed to get transactions' });
    }
});

// Add new transaction
router.post('/', auth, async (req, res) => {
    try {
        console.log('Transaction POST route: req.user:', req.user);
        console.log('Transaction POST route: req.user._id:', req.user ? req.user._id : null);

        const { type, category, amount, description, date } = req.body;

        // Validate required fields
        if (!type || !category || !amount) {
            return res.status(400).json({ error: 'Type, category and amount are required' });
        }

        // Validate transaction type
        if (!['income', 'expense'].includes(type)) {
            return res.status(400).json({ error: 'Invalid transaction type' });
        }

        // Validate amount
        if (isNaN(amount) || amount <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }

        // Create transaction object
        const transaction = new Transaction({
            user: req.user._id,
            type,
            category,
            amount,
            description: description || '',
            date: date ? new Date(date) : new Date()
        });

        // Save transaction to database
        const savedTransaction = await transaction.save();

        // Update user's balance
        if (type === 'income') {
            req.user.balance += amount;
        } else {
            req.user.balance -= amount;
        }
        await req.user.save();

        // Broadcast new transaction to user's WebSocket connections
        broadcastToUser(req.user._id.toString(), 'transaction:added', savedTransaction);

        res.status(201).json(savedTransaction);
    } catch (error) {
        console.error('Error adding transaction:', error);
        res.status(500).json({ error: 'Failed to add transaction' });
    }
});

// Update transaction
router.patch('/:id', auth, async (req, res) => {
    try {
        const { type, category, amount, description, date } = req.body;

        // Validate required fields
        if (!type || !category || !amount) {
            return res.status(400).json({ error: 'Type, category and amount are required' });
        }

        // Validate transaction type
        if (!['income', 'expense'].includes(type)) {
            return res.status(400).json({ error: 'Invalid transaction type' });
        }

        // Validate amount
        if (isNaN(amount) || amount <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }

        // Find existing transaction
        const transaction = await Transaction.findOne({ _id: req.params.id, user: req.user._id });
        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        // Adjust user's balance based on old transaction
        if (transaction.type === 'income') {
            req.user.balance -= transaction.amount;
        } else {
            req.user.balance += transaction.amount;
        }

        // Update transaction fields
        transaction.type = type;
        transaction.category = category;
        transaction.amount = amount;
        transaction.description = description || '';
        transaction.date = date ? new Date(date) : transaction.date;

        // Save updated transaction
        const updatedTransaction = await transaction.save();

        // Adjust user's balance based on new transaction
        if (type === 'income') {
            req.user.balance += amount;
        } else {
            req.user.balance -= amount;
        }
        await req.user.save();

        // Broadcast updated transaction to user's WebSocket connections
        broadcastToUser(req.user._id.toString(), 'transaction:updated', updatedTransaction);

        res.json(updatedTransaction);
    } catch (error) {
        console.error('Error updating transaction:', error);
        res.status(500).json({ error: 'Failed to update transaction' });
    }
});

// Delete transaction
router.delete('/:id', auth, async (req, res) => {
    try {
        // Find existing transaction
        const transaction = await Transaction.findOne({ _id: req.params.id, user: req.user._id });
        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        // Adjust user's balance based on transaction to be deleted
        if (transaction.type === 'income') {
            req.user.balance -= transaction.amount;
        } else {
            req.user.balance += transaction.amount;
        }
        await req.user.save();

        // Delete transaction
        await transaction.remove();

        // Broadcast deleted transaction to user's WebSocket connections
        broadcastToUser(req.user._id.toString(), 'transaction:deleted', transaction);

        res.json({ message: 'Transaction deleted successfully' });
    } catch (error) {
        console.error('Error deleting transaction:', error);
        res.status(500).json({ error: 'Failed to delete transaction' });
    }
});

module.exports = router;
