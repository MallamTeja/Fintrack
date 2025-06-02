/**
 * Budget Routes Module
 * Handles CRUD operations for user budgets
 * Includes real-time updates via WebSocket and spending calculations
 */

const express = require('express');
const router = express.Router();
const Budget = require('../models/Budget');
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');
const { broadcastEvent, broadcastToUser } = require('../websocketManager');

/**
 * Get all budgets for authenticated user
 * Includes current spending calculations for each budget category
 * GET /api/budgets
 * @route GET /api/budgets
 * @requires auth - JWT authentication middleware
 * @returns {Array} List of budgets with current spending
 */
router.get('/', auth, async (req, res) => {
    try {
        // Get all budgets for the user
        const budgets = await Budget.find({ user: req.user._id });
        
        // Calculate current month's date range
        const currentDate = new Date();
        const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        
        // Get all expense transactions for current month
        const monthlyTransactions = await Transaction.find({
            user: req.user._id,
            date: { $gte: firstDayOfMonth },
            type: 'expense'
        });
        
        // Calculate current spending for each budget category
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

/**
 * Add new budget
 * POST /api/budgets
 * @route POST /api/budgets
 * @requires auth - JWT authentication middleware
 * @param {string} category - Budget category
 * @param {number} limit - Monthly budget limit
 * @returns {Object} Created budget
 */
router.post('/', auth, async (req, res) => {
    try {
        const { category, limit } = req.body;
        
        // Validate required fields
        if (!category || !limit) {
            return res.status(400).json({ error: 'Category and limit are required' });
        }
        
        // Validate budget limit
        if (isNaN(limit) || limit <= 0) {
            return res.status(400).json({ error: 'Invalid budget limit' });
        }

        // Check for existing budget in the same category
        const existingBudget = await Budget.findOne({
            user: req.user._id,
            category
        });

        if (existingBudget) {
            return res.status(400).json({ error: 'Budget for this category already exists' });
        }

        // Create and save new budget
        const budget = new Budget({
            user: req.user._id,
            category,
            limit
        });

        await budget.save();
        
        // Broadcast budget creation events
        broadcastEvent('budget:added', budget);
        broadcastToUser(req.user._id.toString(), 'budget:added', budget);
        
        res.status(201).json(budget);
    } catch (error) {
        console.error('Error creating budget:', error);
        res.status(500).json({ error: 'Failed to create budget' });
    }
});

/**
 * Update existing budget
 * PATCH /api/budgets/:id
 * @route PATCH /api/budgets/:id
 * @requires auth - JWT authentication middleware
 * @param {string} id - Budget ID
 * @param {number} limit - New monthly budget limit
 * @returns {Object} Updated budget
 */
router.patch('/:id', auth, async (req, res) => {
    try {
        const { limit } = req.body;
        
        // Validate budget limit
        if (!limit || isNaN(limit) || limit <= 0) {
            return res.status(400).json({ error: 'Invalid budget limit' });
        }

        // Find and update budget
        const budget = await Budget.findOneAndUpdate(
            { _id: req.params.id, user: req.user._id },
            { limit },
            { new: true }
        );

        if (!budget) {
            return res.status(404).json({ error: 'Budget not found' });
        }

        // Broadcast budget update events
        broadcastEvent('budget:updated', budget);
        broadcastToUser(req.user._id.toString(), 'budget:updated', budget);

        res.json(budget);
    } catch (error) {
        console.error('Error updating budget:', error);
        res.status(500).json({ error: 'Failed to update budget' });
    }
});

/**
 * Delete budget
 * DELETE /api/budgets/:id
 * @route DELETE /api/budgets/:id
 * @requires auth - JWT authentication middleware
 * @param {string} id - Budget ID
 * @returns {Object} Success message
 */
router.delete('/:id', auth, async (req, res) => {
    try {
        // Find and delete budget
        const budget = await Budget.findOneAndDelete({
            _id: req.params.id,
            user: req.user._id
        });

        if (!budget) {
            return res.status(404).json({ error: 'Budget not found' });
        }

        // Broadcast budget deletion events
        broadcastEvent('budget:deleted', budget);
        broadcastToUser(req.user._id.toString(), 'budget:deleted', budget);

        res.json({ message: 'Budget deleted successfully' });
    } catch (error) {
        console.error('Error deleting budget:', error);
        res.status(500).json({ error: 'Failed to delete budget' });
    }
});

module.exports = router; 