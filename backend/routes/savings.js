const express = require('express');
const router = express.Router();
const { SavingsGoal } = require('../db');
const auth = require('../middleware/auth');
const { broadcastEvent, broadcastToUser } = require('../websocketManager');

// Get all savings goals
router.get('/', auth, async (req, res) => {
    try {
        const goals = await SavingsGoal.find({ user_id: req.user._id })
            .sort({ due_date: 1 });
        res.json(goals);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create new savings goal
router.post('/', auth, async (req, res) => {
    try {
        const goal = new SavingsGoal({
            ...req.body,
            user_id: req.user._id
        });
        await goal.save();
        
        // Emit WebSocket event for real-time updates
        broadcastEvent('savingsGoal:added', goal);
        broadcastToUser(req.user._id.toString(), 'savingsGoal:added', goal);
        
        res.status(201).json(goal);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Update savings goal
router.patch('/:id', auth, async (req, res) => {
    try {
        const goal = await SavingsGoal.findOneAndUpdate(
            { _id: req.params.id, user_id: req.user._id },
            req.body,
            { new: true, runValidators: true }
        );
        if (!goal) {
            return res.status(404).json({ error: 'Goal not found' });
        }
        
        // Emit WebSocket event for real-time updates
        broadcastEvent('savingsGoal:updated', goal);
        broadcastToUser(req.user._id.toString(), 'savingsGoal:updated', goal);
        
        res.json(goal);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Delete savings goal
router.delete('/:id', auth, async (req, res) => {
    try {
        const goal = await SavingsGoal.findOneAndDelete({
            _id: req.params.id,
            user_id: req.user._id
        });
        if (!goal) {
            return res.status(404).json({ error: 'Goal not found' });
        }
        
        // Emit WebSocket event for real-time updates
        broadcastEvent('savingsGoal:deleted', goal);
        broadcastToUser(req.user._id.toString(), 'savingsGoal:deleted', goal);
        
        res.json(goal);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/bulk', auth, async (req, res) => {
    try {
        const goals = req.body;
        if (!Array.isArray(goals)) {
            return res.status(400).json({ error: 'Request body must be an array of savings goals' });
        }

        const userId = req.user._id;
        const savedGoals = [];

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

        // Emit WebSocket event for real-time updates
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
