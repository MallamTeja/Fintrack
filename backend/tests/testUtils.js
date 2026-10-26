/**
 * Test Utilities
 * Common testing helpers and fixtures
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

/**
 * Create a test user
 */
const createTestUser = async (overrides = {}) => {
    const defaultUser = {
        name: 'Test User',
        email: 'test@example.com',
        password: await bcrypt.hash('password123', 12)
    };
    
    const userData = { ...defaultUser, ...overrides };
    const user = new User(userData);
    await user.save();
    
    return user;
};

/**
 * Create a JWT token for testing
 */
const createTestToken = (userId) => {
    return jwt.sign(
        { userId },
        'test-jwt-secret',
        { expiresIn: '1h' }
    );
};

/**
 * Create a test transaction
 */
const createTestTransaction = async (userId, overrides = {}) => {
    const defaultTransaction = {
        user: userId,
        type: 'income',
        category: 'Salary',
        amount: 1000,
        description: 'Test transaction',
        date: new Date()
    };
    
    const transactionData = { ...defaultTransaction, ...overrides };
    const transaction = new Transaction(transactionData);
    await transaction.save();
    
    return transaction;
};

/**
 * Mock request object
 */
const mockRequest = (overrides = {}) => {
    return {
        body: {},
        params: {},
        query: {},
        user: null,
        header: jest.fn(),
        ...overrides
    };
};

/**
 * Mock response object
 */
const mockResponse = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    return res;
};

/**
 * Mock next function
 */
const mockNext = jest.fn();

module.exports = {
    createTestUser,
    createTestToken,
    createTestTransaction,
    mockRequest,
    mockResponse,
    mockNext
};