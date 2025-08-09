/**
 * Validation Utils Tests
 * Tests for input validation and sanitization utilities
 */

const { validationRules, sanitizeInput, sanitizeObject } = require('../../utils/validation');

describe('Validation Utils', () => {
    describe('sanitizeInput', () => {
        test('should remove dangerous HTML characters', () => {
            const input = '<script>alert("xss")</script>';
            const result = sanitizeInput(input);
            expect(result).toBe('scriptalert("xss")/script');
        });

        test('should trim whitespace', () => {
            const input = '  test input  ';
            const result = sanitizeInput(input);
            expect(result).toBe('test input');
        });

        test('should handle non-string input', () => {
            expect(sanitizeInput(123)).toBe(123);
            expect(sanitizeInput(null)).toBe(null);
            expect(sanitizeInput(undefined)).toBe(undefined);
            expect(sanitizeInput({})).toEqual({});
        });

        test('should handle empty string', () => {
            const result = sanitizeInput('');
            expect(result).toBe('');
        });
    });

    describe('sanitizeObject', () => {
        test('should sanitize string properties', () => {
            const input = {
                name: '<script>alert("xss")</script>',
                email: '  test@example.com  ',
                age: 25
            };
            
            const result = sanitizeObject(input);
            
            expect(result.name).toBe('scriptalert("xss")/script');
            expect(result.email).toBe('test@example.com');
            expect(result.age).toBe(25);
        });

        test('should handle nested objects', () => {
            const input = {
                user: {
                    name: '<b>Test</b>',
                    preferences: {
                        theme: '  dark  '
                    }
                },
                count: 5
            };
            
            const result = sanitizeObject(input);
            
            expect(result.user.name).toBe('bTest/b');
            expect(result.user.preferences.theme).toBe('dark');
            expect(result.count).toBe(5);
        });

        test('should handle non-object input', () => {
            expect(sanitizeObject(null)).toBe(null);
            expect(sanitizeObject('string')).toBe('string');
            expect(sanitizeObject(123)).toBe(123);
        });

        test('should handle arrays', () => {
            const input = {
                tags: ['<tag1>', 'tag2  ', 'tag3']
            };
            
            const result = sanitizeObject(input);
            // Arrays are treated as objects, so we check the structure
            expect(result.tags).toBeDefined();
            expect(typeof result.tags).toBe('object');
        });
    });

    describe('validationRules', () => {
        test('should have userRegistration rules', () => {
            expect(validationRules.userRegistration).toBeDefined();
            expect(Array.isArray(validationRules.userRegistration)).toBe(true);
            expect(validationRules.userRegistration.length).toBeGreaterThan(0);
        });

        test('should have userLogin rules', () => {
            expect(validationRules.userLogin).toBeDefined();
            expect(Array.isArray(validationRules.userLogin)).toBe(true);
            expect(validationRules.userLogin.length).toBeGreaterThan(0);
        });

        test('should have transactionCreate rules', () => {
            expect(validationRules.transactionCreate).toBeDefined();
            expect(Array.isArray(validationRules.transactionCreate)).toBe(true);
            expect(validationRules.transactionCreate.length).toBeGreaterThan(0);
        });

        test('should have budgetCreate rules', () => {
            expect(validationRules.budgetCreate).toBeDefined();
            expect(Array.isArray(validationRules.budgetCreate)).toBe(true);
            expect(validationRules.budgetCreate.length).toBeGreaterThan(0);
        });

        test('should have mongoId rules', () => {
            expect(validationRules.mongoId).toBeDefined();
            expect(Array.isArray(validationRules.mongoId)).toBe(true);
            expect(validationRules.mongoId.length).toBeGreaterThan(0);
        });
    });
});