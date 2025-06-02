/**
 * Savings Goals Routes Module
 * Handles CRUD operations for user savings goals
 * Includes real-time updates via WebSocket
 */

const express = require('express');
const router = express.Router();
const { SavingsGoal } = require('../db');
const auth = require('../middleware/auth');
const { broadcastEvent, broadcastToUser } = require('../websocketManager');

/**
 * Get all savings goals for authenticated user
 * GET /api/savings-goals
 * @route GET /api/savings-goals
 * @requires auth - JWT authentication middleware
 * @returns {Array} List of savings goals sorted by due date
 */
router.get('/', auth, async (req, res) => {
    try {
        const goals = await SavingsGoal.find({ user_id: req.user._id })
            .sort({ due_date: 1 });
        res.json(goals);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Create new savings goal
 * POST /api/savings-goals
 * @route POST /api/savings-goals
 * @requires auth - JWT authentication middleware
 * @param {Object} goal - Savings goal data
 * @returns {Object} Created savings goal
 */
router.post('/', auth, async (req, res) => {
    try {
        // Create new savings goal with user ID
        const goal = new SavingsGoal({
            ...req.body,
            user_id: req.user._id
        });
        await goal.save();
        
        // Broadcast goal creation events
        broadcastEvent('savingsGoal:added', goal);
        broadcastToUser(req.user._id.toString(), 'savingsGoal:added', goal);
        
        res.status(201).json(goal);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * Update existing savings goal
 * PATCH /api/savings-goals/:id
 * @route PATCH /api/savings-goals/:id
 * @requires auth - JWT authentication middleware
 * @param {string} id - Savings goal ID
 * @param {Object} updates - Updated savings goal data
 * @returns {Object} Updated savings goal
 */
router.patch('/:id', auth, async (req, res) => {
    try {
        // Find and update savings goal
        const goal = await SavingsGoal.findOneAndUpdate(
            { _id: req.params.id, user_id: req.user._id },
            req.body,
            { new: true, runValidators: true }
        );
        if (!goal) {
            return res.status(404).json({ error: 'Goal not found' });
        }
        
        // Broadcast goal update events
        broadcastEvent('savingsGoal:updated', goal);
        broadcastToUser(req.user._id.toString(), 'savingsGoal:updated', goal);
        
        res.json(goal);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * Delete savings goal
 * DELETE /api/savings-goals/:id
 * @route DELETE /api/savings-goals/:id
 * @requires auth - JWT authentication middleware
 * @param {string} id - Savings goal ID
 * @returns {Object} Deleted savings goal
 */
router.delete('/:id', auth, async (req, res) => {
    try {
        // Find and delete savings goal
        const goal = await SavingsGoal.findOneAndDelete({
            _id: req.params.id,
            user_id: req.user._id
        });
        if (!goal) {
            return res.status(404).json({ error: 'Goal not found' });
        }
        
        // Broadcast goal deletion events
        broadcastEvent('savingsGoal:deleted', goal);
        broadcastToUser(req.user._id.toString(), 'savingsGoal:deleted', goal);
        
        res.json(goal);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Bulk create/update savings goals
 * POST /api/savings-goals/bulk
 * @route POST /api/savings-goals/bulk
 * @requires auth - JWT authentication middleware
 * @param {Array} goals - Array of savings goals to create or update
 * @returns {Array} Array of created/updated savings goals
 */
router.post('/bulk', auth, async (req, res) => {
    try {
        const goals = req.body;
        // Validate request body
        if (!Array.isArray(goals)) {
            return res.status(400).json({ error: 'Request body must be an array of savings goals' });
        }

        const userId = req.user._id;
        const savedGoals = [];

        // Process each goal in the array
        for (const goalData of goals) {
            if (goalData._id) {
                // Update existing goal
                const updatedGoal = await SavingsGoal.findOneAndUpdate(
                    { _id: goalData._id, user_id: userId },
                    goalData,
                    { new: true, runValidators: true }
                );
                if (updatedGoal) {
                    savedGoals.push(updatedGoal);
                }
            } else {
                // Create new goal
                const newGoal = new SavingsGoal({
                    ...goalData,
                    user_id: userId
                });
                await newGoal.save();
                savedGoals.push(newGoal);
            }
        }

        // Broadcast update events for all processed goals
        for (const goal of savedGoals) {
            broadcastEvent('savingsGoal:updated', goal);
            broadcastToUser(userId.toString(), 'savingsGoal:updated', goal);
        }

        res.json(savedGoals);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
