/**
 * Authentication Middleware Tests
 * Tests for JWT authentication middleware
 */

const authMiddleware = require('../../middleware/auth');
const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const { createTestUser, mockRequest, mockResponse, mockNext } = require('../testUtils');

// Mock config
jest.mock('config', () => ({
    get: jest.fn().mockReturnValue('test-jwt-secret')
}));

describe('Authentication Middleware', () => {
    let testUser;
    let validToken;

    beforeEach(async () => {
        testUser = await createTestUser();
        validToken = jwt.sign({ userId: testUser._id }, 'test-jwt-secret', { expiresIn: '1h' });
        jest.clearAllMocks();
    });

    describe('Valid Authentication', () => {
        test('should authenticate user with valid token', async () => {
            const req = mockRequest({
                header: jest.fn().mockReturnValue(`Bearer ${validToken}`)
            });
            const res = mockResponse();
            const next = mockNext;

            await authMiddleware(req, res, next);

            expect(req.user).toBeDefined();
            expect(req.user._id.toString()).toBe(testUser._id.toString());
            expect(next).toHaveBeenCalledWith();
        });

        test('should call next() when authentication succeeds', async () => {
            const req = mockRequest({
                header: jest.fn().mockReturnValue(`Bearer ${validToken}`)
            });
            const res = mockResponse();
            const next = mockNext;

            await authMiddleware(req, res, next);

            expect(next).toHaveBeenCalledTimes(1);
            expect(next).toHaveBeenCalledWith();
        });
    });

    describe('Invalid Authentication', () => {
        test('should reject request without authorization header', async () => {
            const req = mockRequest({
                header: jest.fn().mockReturnValue(null)
            });
            const res = mockResponse();
            const next = mockNext;

            await authMiddleware(req, res, next);

            expect(next).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Access denied. No token provided',
                statusCode: 401
            }));
        });

        test('should reject request with invalid token format', async () => {
            const req = mockRequest({
                header: jest.fn().mockReturnValue('InvalidFormat token')
            });
            const res = mockResponse();
            const next = mockNext;

            await authMiddleware(req, res, next);

            expect(next).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Invalid token format. Use Bearer token',
                statusCode: 401
            }));
        });

        test('should reject request with invalid token', async () => {
            const req = mockRequest({
                header: jest.fn().mockReturnValue('Bearer invalid-token')
            });
            const res = mockResponse();
            const next = mockNext;

            await authMiddleware(req, res, next);

            expect(next).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Invalid token. Please login again'
            }));
        });

        test('should reject request with expired token', async () => {
            const expiredToken = jwt.sign(
                { userId: testUser._id }, 
                'test-jwt-secret', 
                { expiresIn: '-1h' }
            );
            
            const req = mockRequest({
                header: jest.fn().mockReturnValue(`Bearer ${expiredToken}`)
            });
            const res = mockResponse();
            const next = mockNext;

            await authMiddleware(req, res, next);

            expect(next).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Token has expired. Please login again'
            }));
        });

        test('should reject request when user does not exist', async () => {
            // Delete the user but keep the token
            await User.findByIdAndDelete(testUser._id);
            
            const req = mockRequest({
                header: jest.fn().mockReturnValue(`Bearer ${validToken}`)
            });
            const res = mockResponse();
            const next = mockNext;

            await authMiddleware(req, res, next);

            expect(next).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Invalid token. User not found',
                statusCode: 401
            }));
        });
    });

    describe('Token Format', () => {
        test('should extract token correctly from Bearer header', async () => {
            const req = mockRequest({
                header: jest.fn().mockReturnValue(`Bearer ${validToken}`)
            });
            const res = mockResponse();
            const next = mockNext;

            await authMiddleware(req, res, next);

            expect(req.header).toHaveBeenCalledWith('Authorization');
            expect(req.user).toBeDefined();
        });

        test('should handle Bearer token with extra spaces', async () => {
            const req = mockRequest({
                header: jest.fn().mockReturnValue(`Bearer  ${validToken}  `)
            });
            const res = mockResponse();
            const next = mockNext;

            await authMiddleware(req, res, next);

            expect(req.user).toBeDefined();
        });
    });
});