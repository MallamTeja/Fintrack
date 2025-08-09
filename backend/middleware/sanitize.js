/**
 * Input Sanitization Middleware
 * Sanitizes request body, query, and params to prevent XSS attacks
 */

const { sanitizeObject } = require('../utils/validation');

/**
 * Middleware to sanitize all user inputs
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object  
 * @param {Function} next - Express next function
 */
const sanitizeInput = (req, res, next) => {
    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
        req.body = sanitizeObject(req.body);
    }
    
    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
        req.query = sanitizeObject(req.query);
    }
    
    // Sanitize URL parameters
    if (req.params && typeof req.params === 'object') {
        req.params = sanitizeObject(req.params);
    }
    
    next();
};

module.exports = sanitizeInput;