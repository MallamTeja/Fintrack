/**
 * User Routes Module
 * Handles user registration, authentication, and profile management
 * Implements JWT-based authentication and password hashing
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const auth = require('../middleware/auth');

/**
 * Register a new user
 * POST /api/users/register
 * @route POST /api/users/register
 * @access Public
 * @param {string} name - User's full name
 * @param {string} email - User's email address
 * @param {string} password - User's password
 * @returns {Object} JWT token
 */
router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Check for existing user
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ msg: 'User already exists' });
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

        // Save user to database
        await user.save();

        // Create JWT payload
        const payload = {
            user: {
                id: user.id
            }
        };

        // Generate and return JWT token
        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '24h' },
            (err, token) => {
                if (err) throw err;
                res.json({ token });
            }
        );
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

/**
 * Authenticate user and return JWT token
 * POST /api/users/login
 * @route POST /api/users/login
 * @access Public
 * @param {string} email - User's email address
 * @param {string} password - User's password
 * @returns {Object} JWT token
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user by email
        let user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ msg: 'Invalid credentials' });
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid credentials' });
        }

        // Create JWT payload
        const payload = {
            user: {
                id: user.id
            }
        };

        // Generate and return JWT token
        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '24h' },
            (err, token) => {
                if (err) throw err;
                res.json({ token });
            }
        );
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

/**
 * Get current user's profile
 * GET /api/users/me
 * @route GET /api/users/me
 * @access Private
 * @requires auth - JWT authentication middleware
 * @returns {Object} User profile data (excluding password)
 */
router.get('/me', auth, async (req, res) => {
    try {
        // Find user by ID, excluding password field
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

module.exports = router;
