/**
 * Authentication Middleware
 * Validates JWT tokens and attaches user information to requests
 * Implements proper error handling and security
 */

const jwt = require('jsonwebtoken');
const config = require('config');
const User = require('../models/User');
const { AppError } = require('../utils/errorHandler');

/**
 * Authentication middleware function
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const authMiddleware = async function(req, res, next) {
    try {
        // Get token from header
        const authHeader = req.header('Authorization');

        if (!authHeader) {
            throw new AppError('Access denied. No token provided', 401);
        }

        // Check if token format is correct
        if (!authHeader.startsWith('Bearer ')) {
            throw new AppError('Invalid token format. Use Bearer token', 401);
        }

        // Extract token
        const token = authHeader.split(' ')[1];

        // Verify token
        const decoded = jwt.verify(token, config.get('jwtSecret'));
        
        // Find user by id
        const user = await User.findById(decoded.userId);
        if (!user) {
            throw new AppError('Invalid token. User not found', 401);
        }
        
        // Add user info to request
        req.user = user;
        next();
    } catch (error) {
        // Handle JWT specific errors
        if (error.name === 'TokenExpiredError') {
            return next(new AppError('Token has expired. Please login again', 401));
        }
        
        if (error.name === 'JsonWebTokenError') {
            return next(new AppError('Invalid token. Please login again', 401));
        }

        // Pass other errors to error handler
        next(error);
    }
};

module.exports = authMiddleware;
