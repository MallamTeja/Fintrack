/**
 * Input Validation Utilities
 * Provides reusable validation functions and sanitization
 */

const { body, param, query, validationResult } = require('express-validator');
const { AppError } = require('./errorHandler');

/**
 * Check validation result and throw error if invalid
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const checkValidationResult = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const errorMessages = errors.array().map(error => error.msg);
        throw new AppError(errorMessages.join(', '), 400);
    }
    next();
};

/**
 * Common validation rules
 */
const validationRules = {
    // User validation
    userRegistration: [
        body('name')
            .trim()
            .isLength({ min: 2, max: 50 })
            .withMessage('Name must be between 2 and 50 characters')
            .matches(/^[a-zA-Z\s]+$/)
            .withMessage('Name can only contain letters and spaces'),
        
        body('email')
            .isEmail()
            .withMessage('Please provide a valid email address')
            .normalizeEmail(),
        
        body('password')
            .isLength({ min: 6, max: 128 })
            .withMessage('Password must be between 6 and 128 characters')
            .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
            .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number')
    ],

    userLogin: [
        body('email')
            .isEmail()
            .withMessage('Please provide a valid email address')
            .normalizeEmail(),
        
        body('password')
            .notEmpty()
            .withMessage('Password is required')
    ],

    // Transaction validation
    transactionCreate: [
        body('description')
            .trim()
            .isLength({ min: 1, max: 200 })
            .withMessage('Description must be between 1 and 200 characters'),
        
        body('amount')
            .isNumeric()
            .withMessage('Amount must be a number')
            .custom(value => {
                if (value <= 0) {
                    throw new Error('Amount must be greater than 0');
                }
                if (value > 1000000) {
                    throw new Error('Amount cannot exceed 1,000,000');
                }
                return true;
            }),
        
        body('type')
            .isIn(['income', 'expense'])
            .withMessage('Type must be either income or expense'),
        
        body('category')
            .trim()
            .isLength({ min: 1, max: 50 })
            .withMessage('Category must be between 1 and 50 characters'),
        
        body('date')
            .isISO8601()
            .withMessage('Date must be in valid ISO format')
            .toDate()
    ],

    // Budget validation
    budgetCreate: [
        body('category')
            .trim()
            .isLength({ min: 1, max: 50 })
            .withMessage('Category must be between 1 and 50 characters'),
        
        body('limit')
            .isNumeric()
            .withMessage('Limit must be a number')
            .custom(value => {
                if (value <= 0) {
                    throw new Error('Budget limit must be greater than 0');
                }
                return true;
            }),
        
        body('period')
            .isIn(['weekly', 'monthly', 'yearly'])
            .withMessage('Period must be weekly, monthly, or yearly')
    ],

    // ID parameter validation
    mongoId: [
        param('id')
            .isMongoId()
            .withMessage('Invalid ID format')
    ]
};

/**
 * Sanitize user input to prevent XSS attacks
 * @param {string} input - User input string
 * @returns {string} Sanitized string
 */
const sanitizeInput = (input) => {
    if (typeof input !== 'string') return input;
    
    return input
        .replace(/[<>]/g, '') // Remove < and > characters
        .trim();
};

/**
 * Sanitize object properties recursively
 * @param {Object} obj - Object to sanitize
 * @returns {Object} Sanitized object
 */
const sanitizeObject = (obj) => {
    if (typeof obj !== 'object' || obj === null) return obj;
    
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
            sanitized[key] = sanitizeInput(value);
        } else if (typeof value === 'object') {
            sanitized[key] = sanitizeObject(value);
        } else {
            sanitized[key] = value;
        }
    }
    return sanitized;
};

module.exports = {
    validationRules,
    checkValidationResult,
    sanitizeInput,
    sanitizeObject
};