/**
 * Error Handling Utilities
 * Provides centralized error handling and response formatting
 */

const logger = require('./logger');

/**
 * Custom error class for application-specific errors
 */
class AppError extends Error {
    constructor(message, statusCode = 500, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.name = 'AppError';
        
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Standard error response format
 * @param {Error} error - The error object
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code
 */
const sendErrorResponse = (res, error, statusCode = 500) => {
    const errorResponse = {
        success: false,
        error: {
            message: error.message || 'An unexpected error occurred',
            type: error.name || 'ServerError'
        }
    };

    // Add error details in development mode
    if (process.env.NODE_ENV === 'development') {
        errorResponse.error.stack = error.stack;
    }

    logger.error('Error occurred:', {
        message: error.message,
        stack: error.stack,
        statusCode
    });

    res.status(statusCode).json(errorResponse);
};

/**
 * Handle different types of errors
 * @param {Error} error - The error object
 * @param {Object} res - Express response object
 */
const handleError = (error, res) => {
    if (error instanceof AppError) {
        return sendErrorResponse(res, error, error.statusCode);
    }

    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(val => val.message);
        const validationError = new AppError(messages.join(', '), 400);
        return sendErrorResponse(res, validationError, 400);
    }

    // Handle Mongoose duplicate key errors
    if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        const duplicateError = new AppError(`${field} already exists`, 409);
        return sendErrorResponse(res, duplicateError, 409);
    }

    // Handle Mongoose ObjectId errors
    if (error.kind === 'ObjectId') {
        const castError = new AppError('Resource not found', 404);
        return sendErrorResponse(res, castError, 404);
    }

    // Handle JWT errors
    if (error.name === 'JsonWebTokenError') {
        const jwtError = new AppError('Invalid token', 401);
        return sendErrorResponse(res, jwtError, 401);
    }

    if (error.name === 'TokenExpiredError') {
        const jwtError = new AppError('Token has expired', 401);
        return sendErrorResponse(res, jwtError, 401);
    }

    // Default server error
    sendErrorResponse(res, error, 500);
};

/**
 * Async error wrapper to handle promise rejections
 * @param {Function} fn - Async function to wrap
 */
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

/**
 * Global error handling middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const globalErrorHandler = (err, req, res, next) => {
    handleError(err, res);
};

module.exports = {
    AppError,
    handleError,
    asyncHandler,
    globalErrorHandler,
    sendErrorResponse
};