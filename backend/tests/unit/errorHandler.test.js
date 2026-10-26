/**
 * Error Handler Utils Tests
 * Tests for centralized error handling utilities
 */

const { AppError, handleError, asyncHandler } = require('../../utils/errorHandler');
const { mockRequest, mockResponse, mockNext } = require('../testUtils');

describe('Error Handler Utils', () => {
    describe('AppError', () => {
        test('should create AppError with default values', () => {
            const error = new AppError('Test error');
            
            expect(error.message).toBe('Test error');
            expect(error.statusCode).toBe(500);
            expect(error.isOperational).toBe(true);
            expect(error.name).toBe('AppError');
        });

        test('should create AppError with custom values', () => {
            const error = new AppError('Custom error', 400, false);
            
            expect(error.message).toBe('Custom error');
            expect(error.statusCode).toBe(400);
            expect(error.isOperational).toBe(false);
            expect(error.name).toBe('AppError');
        });

        test('should capture stack trace', () => {
            const error = new AppError('Test error');
            expect(error.stack).toBeDefined();
        });
    });

    describe('asyncHandler', () => {
        test('should handle successful async function', async () => {
            const asyncFn = jest.fn().mockResolvedValue('success');
            const wrappedFn = asyncHandler(asyncFn);
            
            const req = mockRequest();
            const res = mockResponse();
            const next = mockNext;

            await wrappedFn(req, res, next);

            expect(asyncFn).toHaveBeenCalledWith(req, res, next);
            expect(next).not.toHaveBeenCalled();
        });

        test('should handle async function rejection', async () => {
            const error = new Error('Async error');
            const asyncFn = jest.fn().mockRejectedValue(error);
            const wrappedFn = asyncHandler(asyncFn);
            
            const req = mockRequest();
            const res = mockResponse();
            const next = mockNext;

            await wrappedFn(req, res, next);

            expect(asyncFn).toHaveBeenCalledWith(req, res, next);
            expect(next).toHaveBeenCalledWith(error);
        });
    });

    describe('handleError', () => {
        let consoleErrorSpy;

        beforeEach(() => {
            consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        });

        afterEach(() => {
            consoleErrorSpy.mockRestore();
        });

        test('should handle AppError', () => {
            const error = new AppError('Test error', 400);
            const res = mockResponse();

            handleError(error, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: {
                    message: 'Test error',
                    type: 'AppError'
                }
            });
        });

        test('should handle ValidationError', () => {
            const error = {
                name: 'ValidationError',
                errors: {
                    field1: { message: 'Field 1 error' },
                    field2: { message: 'Field 2 error' }
                }
            };
            const res = mockResponse();

            handleError(error, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: {
                    message: 'Field 1 error, Field 2 error',
                    type: 'AppError'
                }
            });
        });

        test('should handle duplicate key error', () => {
            const error = {
                code: 11000,
                keyPattern: { email: 1 }
            };
            const res = mockResponse();

            handleError(error, res);

            expect(res.status).toHaveBeenCalledWith(409);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: {
                    message: 'email already exists',
                    type: 'AppError'
                }
            });
        });

        test('should handle ObjectId error', () => {
            const error = {
                kind: 'ObjectId',
                message: 'Cast to ObjectId failed'
            };
            const res = mockResponse();

            handleError(error, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: {
                    message: 'Resource not found',
                    type: 'AppError'
                }
            });
        });

        test('should handle JWT errors', () => {
            const jwtError = {
                name: 'JsonWebTokenError',
                message: 'Invalid token'
            };
            const res = mockResponse();

            handleError(jwtError, res);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: {
                    message: 'Invalid token',
                    type: 'AppError'
                }
            });
        });

        test('should handle TokenExpiredError', () => {
            const error = {
                name: 'TokenExpiredError',
                message: 'Token expired'
            };
            const res = mockResponse();

            handleError(error, res);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: {
                    message: 'Token has expired',
                    type: 'AppError'
                }
            });
        });

        test('should handle generic error', () => {
            const error = new Error('Generic error');
            const res = mockResponse();

            handleError(error, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: {
                    message: 'Generic error',
                    type: 'Error'
                }
            });
        });
    });
});