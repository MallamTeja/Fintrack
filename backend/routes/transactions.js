/**
 * Transaction Routes Module
 * Handles CRUD operations for financial transactions
 * Implements proper validation, error handling, and security
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { asyncHandler, AppError } = require('../utils/errorHandler');
const { validationRules, checkValidationResult } = require('../utils/validation');
const Transaction = require('../models/Transaction');

/**
 * Get all transactions for authenticated user
 * @route GET /api/transactions
 * @access Private
 */
router.get('/', auth, asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, type, category, startDate, endDate } = req.query;
    
    // Build filter object
    const filter = { user: req.user._id };
    
    if (type && ['income', 'expense'].includes(type)) {
        filter.type = type;
    }
    
    if (category) {
        filter.category = new RegExp(category, 'i');
    }
    
    if (startDate || endDate) {
        filter.date = {};
        if (startDate) filter.date.$gte = new Date(startDate);
        if (endDate) filter.date.$lte = new Date(endDate);
    }
    
    const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { date: -1 },
        populate: 'user'
    };
    
    const transactions = await Transaction.find(filter)
        .sort({ date: -1 })
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit));
    
    const total = await Transaction.countDocuments(filter);
    
    res.json({
        success: true,
        data: transactions,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            totalPages: Math.ceil(total / parseInt(limit))
        }
    });
}));

/**
 * Create new transaction
 * @route POST /api/transactions
 * @access Private
 */
router.post('/', [
    auth,
    ...validationRules.transactionCreate,
    checkValidationResult
], asyncHandler(async (req, res) => {
    const { description, amount, type, category, date } = req.body;
    
    const transaction = new Transaction({
        description,
        amount: parseFloat(amount),
        type,
        category,
        date: new Date(date),
        user: req.user._id
    });
    
    await transaction.save();
    await transaction.populate('user', 'name email');
    
    // Broadcast to user's WebSocket connections if available
    if (req.app.locals.wss) {
        req.app.locals.wss.broadcastToUser(req.user._id.toString(), {
            type: 'transaction_added',
            payload: transaction
        });
    }
    
    res.status(201).json({
        success: true,
        data: transaction
    });
}));

/**
 * Get single transaction by ID
 * @route GET /api/transactions/:id
 * @access Private
 */
router.get('/:id', [
    auth,
    ...validationRules.mongoId,
    checkValidationResult
], asyncHandler(async (req, res) => {
    const transaction = await Transaction.findById(req.params.id).populate('user', 'name email');
    
    if (!transaction) {
        throw new AppError('Transaction not found', 404);
    }
    
    // Ensure user owns the transaction
    if (transaction.user._id.toString() !== req.user._id.toString()) {
        throw new AppError('Not authorized to access this transaction', 403);
    }
    
    res.json({
        success: true,
        data: transaction
    });
}));

/**
 * Update transaction
 * @route PUT /api/transactions/:id
 * @access Private
 */
router.put('/:id', [
    auth,
    ...validationRules.mongoId,
    ...validationRules.transactionCreate,
    checkValidationResult
], asyncHandler(async (req, res) => {
    const { description, amount, type, category, date } = req.body;
    
    let transaction = await Transaction.findById(req.params.id);
    
    if (!transaction) {
        throw new AppError('Transaction not found', 404);
    }
    
    // Ensure user owns the transaction
    if (transaction.user.toString() !== req.user._id.toString()) {
        throw new AppError('Not authorized to update this transaction', 403);
    }
    
    // Update transaction
    transaction.description = description;
    transaction.amount = parseFloat(amount);
    transaction.type = type;
    transaction.category = category;
    transaction.date = new Date(date);
    
    await transaction.save();
    await transaction.populate('user', 'name email');
    
    // Broadcast to user's WebSocket connections if available
    if (req.app.locals.wss) {
        req.app.locals.wss.broadcastToUser(req.user._id.toString(), {
            type: 'transaction_updated',
            payload: transaction
        });
    }
    
    res.json({
        success: true,
        data: transaction
    });
}));

/**
 * Delete transaction
 * @route DELETE /api/transactions/:id
 * @access Private
 */
router.delete('/:id', [
    auth,
    ...validationRules.mongoId,
    checkValidationResult
], asyncHandler(async (req, res) => {
    const transaction = await Transaction.findById(req.params.id);
    
    if (!transaction) {
        throw new AppError('Transaction not found', 404);
    }
    
    // Ensure user owns the transaction
    if (transaction.user.toString() !== req.user._id.toString()) {
        throw new AppError('Not authorized to delete this transaction', 403);
    }
    
    await Transaction.findByIdAndDelete(req.params.id);
    
    // Broadcast to user's WebSocket connections if available
    if (req.app.locals.wss) {
        req.app.locals.wss.broadcastToUser(req.user._id.toString(), {
            type: 'transaction_deleted',
            payload: { id: req.params.id }
        });
    }
    
    res.json({
        success: true,
        message: 'Transaction deleted successfully'
    });
}));

/**
 * Get transaction statistics
 * @route GET /api/transactions/stats
 * @access Private
 */
router.get('/stats/summary', auth, asyncHandler(async (req, res) => {
    const { startDate, endDate, category } = req.query;
    
    // Build match stage for aggregation
    const matchStage = { user: req.user._id };
    
    if (startDate || endDate) {
        matchStage.date = {};
        if (startDate) matchStage.date.$gte = new Date(startDate);
        if (endDate) matchStage.date.$lte = new Date(endDate);
    }
    
    if (category) {
        matchStage.category = new RegExp(category, 'i');
    }
    
    const stats = await Transaction.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: '$type',
                total: { $sum: '$amount' },
                count: { $sum: 1 },
                avgAmount: { $avg: '$amount' }
            }
        }
    ]);
    
    const categoryStats = await Transaction.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: { category: '$category', type: '$type' },
                total: { $sum: '$amount' },
                count: { $sum: 1 }
            }
        },
        {
            $group: {
                _id: '$_id.category',
                income: {
                    $sum: {
                        $cond: [{ $eq: ['$_id.type', 'income'] }, '$total', 0]
                    }
                },
                expense: {
                    $sum: {
                        $cond: [{ $eq: ['$_id.type', 'expense'] }, '$total', 0]
                    }
                },
                totalTransactions: { $sum: '$count' }
            }
        }
    ]);
    
    res.json({
        success: true,
        data: {
            typeStats: stats,
            categoryStats
        }
    });
}));

module.exports = router; 