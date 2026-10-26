/**
 * Sanitize Middleware Tests
 * Tests for input sanitization middleware
 */

const sanitizeInput = require('../../middleware/sanitize');
const { mockRequest, mockResponse, mockNext } = require('../testUtils');

describe('Sanitize Middleware', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should sanitize request body', () => {
        const req = mockRequest({
            body: {
                name: '<script>alert("xss")</script>',
                email: '  test@example.com  ',
                description: 'Normal text'
            }
        });
        const res = mockResponse();
        const next = mockNext;

        sanitizeInput(req, res, next);

        expect(req.body.name).toBe('scriptalert("xss")/script');
        expect(req.body.email).toBe('test@example.com');
        expect(req.body.description).toBe('Normal text');
        expect(next).toHaveBeenCalledWith();
    });

    test('should sanitize query parameters', () => {
        const req = mockRequest({
            query: {
                search: '<img src=x onerror=alert(1)>',
                category: '  food  '
            }
        });
        const res = mockResponse();
        const next = mockNext;

        sanitizeInput(req, res, next);

        expect(req.query.search).toBe('img src=x onerror=alert(1)');
        expect(req.query.category).toBe('food');
        expect(next).toHaveBeenCalledWith();
    });

    test('should sanitize URL parameters', () => {
        const req = mockRequest({
            params: {
                id: '507f1f77bcf86cd799439011',
                name: '<b>test</b>'
            }
        });
        const res = mockResponse();
        const next = mockNext;

        sanitizeInput(req, res, next);

        expect(req.params.id).toBe('507f1f77bcf86cd799439011');
        expect(req.params.name).toBe('btest/b');
        expect(next).toHaveBeenCalledWith();
    });

    test('should handle nested objects in body', () => {
        const req = mockRequest({
            body: {
                user: {
                    name: '<script>evil</script>',
                    preferences: {
                        theme: '  dark  '
                    }
                }
            }
        });
        const res = mockResponse();
        const next = mockNext;

        sanitizeInput(req, res, next);

        expect(req.body.user.name).toBe('scriptevil/script');
        expect(req.body.user.preferences.theme).toBe('dark');
        expect(next).toHaveBeenCalledWith();
    });

    test('should handle empty or non-object inputs', () => {
        const req = mockRequest({
            body: null,
            query: undefined,
            params: 'string'
        });
        const res = mockResponse();
        const next = mockNext;

        sanitizeInput(req, res, next);

        expect(req.body).toBe(null);
        expect(req.query).toBe(undefined);
        expect(req.params).toBe('string');
        expect(next).toHaveBeenCalledWith();
    });

    test('should call next() after sanitization', () => {
        const req = mockRequest({
            body: { test: 'value' }
        });
        const res = mockResponse();
        const next = mockNext;

        sanitizeInput(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(next).toHaveBeenCalledWith();
    });
});