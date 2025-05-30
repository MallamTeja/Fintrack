const express = require('express');
const router = express.Router();
const Budget = require('../models/Budget');
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');
const { broadcastEvent, broadcastToUser } = require('../websocketManager');

// Get all budgets for a user
router.get('/', auth, async (req, res) => {
    try {
        const budgets = await Budget.find({ user: req.user._id });
        
        // Calculate current spending for each budget category
        const currentDate = new Date();
        const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        
        const monthlyTransactions = await Transaction.find({
            user: req.user._id,
            date: { $gte: firstDayOfMonth },
            type: 'expense'
        });
        
        const budgetsWithSpending = budgets.map(budget => {
            const spending = monthlyTransactions
                .filter(t => t.category === budget.category)
                .reduce((sum, t) => sum + t.amount, 0);
            
            return {
                ...budget.toObject(),
                current_spending: spending
            };
        });

        res.json(budgetsWithSpending);
    } catch (error) {
        console.error('Error getting budgets:', error);
        res.status(500).json({ error: 'Failed to get budgets' });
    }
});

// Add new budget
router.post('/', auth, async (req, res) => {
    try {
        const { category, limit } = req.body;
        
        if (!category || !limit) {
            return res.status(400).json({ error: 'Category and limit are required' });
        }
        
        if (isNaN(limit) || limit <= 0) {
            return res.status(400).json({ error: 'Invalid budget limit' });
        }

        // Check if budget for this category already exists
        const existingBudget = await Budget.findOne({
            user: req.user._id,
            category
        });

        if (existingBudget) {
            return res.status(400).json({ error: 'Budget for this category already exists' });
        }

        const budget = new Budget({
            user: req.user._id,
            category,
            limit
        });

        await budget.save();
        
        // Emit WebSocket event for real-time updates
        broadcastEvent('budget:added', budget);
        broadcastToUser(req.user._id.toString(), 'budget:added', budget);
        
        res.status(201).json(budget);
    } catch (error) {
        console.error('Error creating budget:', error);
        res.status(500).json({ error: 'Failed to create budget' });
    }
});

// Update budget
router.patch('/:id', auth, async (req, res) => {
    try {
        const { limit } = req.body;
        
        if (!limit || isNaN(limit) || limit <= 0) {
            return res.status(400).json({ error: 'Invalid budget limit' });
        }

        const budget = await Budget.findOneAndUpdate(
            { _id: req.params.id, user: req.user._id },
            { limit },
            { new: true }
        );

        if (!budget) {
            return res.status(404).json({ error: 'Budget not found' });
        }

        // Emit WebSocket event for real-time updates
        broadcastEvent('budget:updated', budget);
        broadcastToUser(req.user._id.toString(), 'budget:updated', budget);

        res.json(budget);
    } catch (error) {
        console.error('Error updating budget:', error);
        res.status(500).json({ error: 'Failed to update budget' });
    }
});

// Delete budget
router.delete('/:id', auth, async (req, res) => {
    try {
        const budget = await Budget.findOneAndDelete({
            _id: req.params.id,
            user: req.user._id
        });

        if (!budget) {
            return res.status(404).json({ error: 'Budget not found' });
        }

        // Emit WebSocket event for real-time updates
        broadcastEvent('budget:deleted', budget);
        broadcastToUser(req.user._id.toString(), 'budget:deleted', budget);

        res.json({ message: 'Budget deleted successfully' });
    } catch (error) {
        console.error('Error deleting budget:', error);
        res.status(500).json({ error: 'Failed to delete budget' });
    }
});

module.exports = router; 