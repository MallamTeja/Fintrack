const mongoose = require('mongoose');

const savingsGoalSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    userName: {
        type: String,
        required: true
    },
    title: {
        type: String,
        required: true
    },
    target_amount: {
        type: Number,
        required: true
    },
    current_amount: {
        type: Number,
        default: 0
    },
    category: {
        type: String,
        required: true
    },
    due_date: {
        type: Date,
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model('SavingsGoal', savingsGoalSchema);