/**
 * Authentication Routes Module
 * Handles user registration, login, logout, and user preferences management
 * Implements JWT-based authentication and password hashing with improved security
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const config = require('config');
const bcrypt = require('bcryptjs');
const auth = require('../middleware/auth');
const { asyncHandler, AppError } = require('../utils/errorHandler');
const { validationRules, checkValidationResult } = require('../utils/validation');
const User = require('../models/User');

/**
 * Register a new user
 * @route POST /api/auth/register
 * @access Public
 */
router.post('/register', [
    ...validationRules.userRegistration,
    checkValidationResult
], asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;
    
    // Check for existing user
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        throw new AppError('User already exists with this email', 409);
    }
    
    // Hash password with bcrypt
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create new user instance
    const user = new User({
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
}));

/**
 * User login
 * @route POST /api/auth/login
 * @access Public
 */
router.post('/login', [
    ...validationRules.userLogin,
    checkValidationResult
], asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    
    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
        throw new AppError('Invalid credentials', 401);
    }
    
    // Verify password using the model method
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
        throw new AppError('Invalid credentials', 401);
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
}));

/**
 * User logout
 * @route POST /api/auth/logout
 * @access Private
 */
router.post('/logout', auth, (req, res) => {
    // Since JWT is stateless, logout is handled client-side
    // Token blacklist could be implemented here if needed
    res.json({ 
        success: true, 
        message: 'Logged out successfully' 
    });
});

/**
 * Get current user data
 * @route GET /api/auth/me
 * @access Private
 */
router.get('/me', auth, asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
        throw new AppError('User not found', 404);
    }
    
    res.json({
        success: true,
        data: user
    });
}));

/**
 * Update user preferences
 * @route PUT /api/auth/preferences
 * @access Private
 */
router.put('/preferences', auth, asyncHandler(async (req, res) => {
    const { theme, currency, notifications } = req.body;
    
    // Validate theme if provided
    if (theme && !['light', 'dark'].includes(theme)) {
        throw new AppError('Theme must be either light or dark', 400);
    }
    
    // Validate currency if provided
    if (currency && typeof currency !== 'string') {
        throw new AppError('Currency must be a string', 400);
    }
    
    const user = await User.findById(req.user._id);
    if (!user) {
        throw new AppError('User not found', 404);
    }
    
    // Update preferences if provided
    if (theme) user.preferences.theme = theme;
    if (currency) user.preferences.currency = currency;
    if (notifications !== undefined) user.preferences.notifications = Boolean(notifications);
    
    await user.save();
    
    res.json({
        success: true,
        data: {
            preferences: user.preferences
        }
    });
}));

/**
 * Change password
 * @route PUT /api/auth/change-password
 * @access Private
 */
router.put('/change-password', auth, asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
        throw new AppError('Current password and new password are required', 400);
    }
    
    if (newPassword.length < 6) {
        throw new AppError('New password must be at least 6 characters long', 400);
    }
    
    const user = await User.findById(req.user._id);
    if (!user) {
        throw new AppError('User not found', 404);
    }
    
    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
        throw new AppError('Current password is incorrect', 400);
    }
    
    // Hash new password
    const salt = await bcrypt.genSalt(12);
    user.password = await bcrypt.hash(newPassword, salt);
    
    await user.save();
    
    res.json({
        success: true,
        message: 'Password changed successfully'
    });
}));

module.exports = router;