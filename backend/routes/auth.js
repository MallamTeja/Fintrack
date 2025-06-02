/**
 * Authentication Routes Module
 * Handles user registration, login, logout, and user preferences management
 * Implements JWT-based authentication and password hashing
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const config = require('config');
const bcrypt = require('bcryptjs');
const auth = require('../middleware/auth');
const User = require('../models/User');

/**
 * Register a new user
 * POST /api/auth/register
 * @route POST /api/auth/register
 * @param {string} name - User's full name
 * @param {string} email - User's email address
 * @param {string} password - User's password (min 6 characters)
 * @returns {Object} JWT token and user data
 */
router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        
        // Validate required fields
        if (!name || !email || !password) {
            return res.status(400).json({ 
                error: 'Please provide all required fields'
            });
        }

        // Validate password length
        if (password.length < 6) {
            return res.status(400).json({
                error: 'Password must be at least 6 characters long'
            });
        }

        // Check for existing user
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ error: 'User already exists with this email' });
        }

        // Hash password with bcrypt
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create new user instance
        user = new User({
            name,
            email,
            password: hashedPassword
        });

        await user.save();

        // Generate JWT token
        const token = jwt.sign(
            { userId: user._id },
            config.get('jwtSecret'),
            { expiresIn: '24h' }
        );

        // Return success response with token and user data
        res.status(201).json({ 
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                preferences: user.preferences
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        
        // Handle validation errors
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ error: messages.join(', ') });
        }
        
        // Handle duplicate email error
        if (error.code === 11000) {
            return res.status(400).json({ error: 'Email already in use' });
        }
        
        res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
});

/**
 * User login
 * POST /api/auth/login
 * @route POST /api/auth/login
 * @param {string} email - User's email address
 * @param {string} password - User's password
 * @returns {Object} JWT token and user data
 */
router.post('/login', async (req, res) => {
    try {
        console.log('Login request received:', req.body);
        const { email, password } = req.body;

        // Validate required fields
        if (!email || !password) {
            console.log('Missing email or password');
            return res.status(400).json({ 
                error: 'Please provide both email and password' 
            });
        }

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            console.log('User not found:', email);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.log('Password mismatch for user:', email);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Update last login timestamp
        user.lastLoginTime = new Date();
        await user.save();

        // Generate JWT token
        const token = jwt.sign(
            { userId: user._id },
            config.get('jwtSecret'),
            { expiresIn: '24h' }
        );

        console.log('Login successful for user:', email);

        // Return success response with token and user data
        res.json({ 
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                lastLoginTime: user.lastLoginTime,
                preferences: user.preferences
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed. Please try again.' });
    }
});

/**
 * User logout
 * POST /api/auth/logout
 * @route POST /api/auth/logout
 * @requires auth - JWT authentication middleware
 * @returns {Object} Success message
 */
router.post('/logout', auth, (req, res) => {
    // Since JWT is stateless, logout is handled client-side
    // Token blacklist could be implemented here if needed
    res.json({ success: true, message: 'Logged out successfully' });
});

/**
 * Get current user data
 * GET /api/auth/me
 * @route GET /api/auth/me
 * @requires auth - JWT authentication middleware
 * @returns {Object} User data (excluding password)
 */
router.get('/me', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Error fetching user data' });
    }
});

/**
 * Update user preferences
 * PUT /api/auth/preferences
 * @route PUT /api/auth/preferences
 * @requires auth - JWT authentication middleware
 * @param {string} theme - User's preferred theme
 * @param {string} currency - User's preferred currency
 * @param {boolean} notifications - User's notification preferences
 * @returns {Object} Updated user preferences
 */
router.put('/preferences', auth, async (req, res) => {
    try {
        const { theme, currency, notifications } = req.body;
        const user = await User.findById(req.user.userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Update preferences if provided
        if (theme) user.preferences.theme = theme;
        if (currency) user.preferences.currency = currency;
        if (notifications !== undefined) user.preferences.notifications = notifications;

        await user.save();

        res.json({
            success: true,
            preferences: user.preferences
        });
    } catch (error) {
        console.error('Update preferences error:', error);
        res.status(500).json({ error: 'Error updating preferences' });
    }
});

module.exports = router;