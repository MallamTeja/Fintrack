/**
 * User Model Tests
 * Tests for the User model functionality
 */

const User = require('../../models/User');
const bcrypt = require('bcryptjs');

describe('User Model', () => {
    describe('User Creation', () => {
        test('should create a valid user', async () => {
            const userData = {
                name: 'John Doe',
                email: 'john@example.com',
                password: await bcrypt.hash('password123', 12)
            };
            
            const user = new User(userData);
            const savedUser = await user.save();
            
            expect(savedUser._id).toBeDefined();
            expect(savedUser.name).toBe(userData.name);
            expect(savedUser.email).toBe(userData.email);
            expect(savedUser.password).toBe(userData.password);
            expect(savedUser.preferences).toBeDefined();
            expect(savedUser.preferences.theme).toBe('light');
            expect(savedUser.preferences.currency).toBe('USD');
            expect(savedUser.preferences.notifications).toBe(true);
        });

        test('should fail to create user without required fields', async () => {
            const user = new User({});
            
            await expect(user.save()).rejects.toThrow();
        });

        test('should fail to create user with invalid email', async () => {
            const userData = {
                name: 'John Doe',
                email: 'invalid-email',
                password: 'password123'
            };
            
            const user = new User(userData);
            await expect(user.save()).rejects.toThrow();
        });

        test('should fail to create user with short password', async () => {
            const userData = {
                name: 'John Doe',
                email: 'john@example.com',
                password: '123'
            };
            
            const user = new User(userData);
            await expect(user.save()).rejects.toThrow();
        });

        test('should not allow duplicate emails', async () => {
            const userData = {
                name: 'John Doe',
                email: 'john@example.com',
                password: await bcrypt.hash('password123', 12)
            };
            
            const user1 = new User(userData);
            await user1.save();
            
            const user2 = new User(userData);
            await expect(user2.save()).rejects.toThrow();
        });
    });

    describe('User Methods', () => {
        test('comparePassword should return true for correct password', async () => {
            const password = 'password123';
            const hashedPassword = await bcrypt.hash(password, 12);
            
            const user = new User({
                name: 'John Doe',
                email: 'john@example.com',
                password: hashedPassword
            });
            
            const result = await user.comparePassword(password);
            expect(result).toBe(true);
        });

        test('comparePassword should return false for incorrect password', async () => {
            const password = 'password123';
            const wrongPassword = 'wrongpassword';
            const hashedPassword = await bcrypt.hash(password, 12);
            
            const user = new User({
                name: 'John Doe',
                email: 'john@example.com',
                password: hashedPassword
            });
            
            const result = await user.comparePassword(wrongPassword);
            expect(result).toBe(false);
        });
    });

    describe('User Preferences', () => {
        test('should allow updating theme preference', async () => {
            const user = new User({
                name: 'John Doe',
                email: 'john@example.com',
                password: await bcrypt.hash('password123', 12)
            });
            
            await user.save();
            
            user.preferences.theme = 'dark';
            await user.save();
            
            const updatedUser = await User.findById(user._id);
            expect(updatedUser.preferences.theme).toBe('dark');
        });

        test('should validate theme values', async () => {
            const user = new User({
                name: 'John Doe',
                email: 'john@example.com',
                password: await bcrypt.hash('password123', 12)
            });
            
            user.preferences.theme = 'invalid-theme';
            await expect(user.save()).rejects.toThrow();
        });
    });
});