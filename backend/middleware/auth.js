const jwt = require('jsonwebtoken');
const config = require('config');
const User = require('../models/User');

const authMiddleware = async function(req, res, next) {
    // Get token from header
    const authHeader = req.header('Authorization');

    if (!authHeader) {
        return res.status(401).json({ 
            error: 'Access denied. No token provided'
        });
    }

    // Check if token format is correct
    if (!authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ 
            error: 'Invalid token format. Use Bearer token'
        });
    }

    // Extract token
    const token = authHeader.split(' ')[1];

    try {
        // Verify token
        const decoded = jwt.verify(token, config.get('jwtSecret'));
        
        // Find user by id
        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(401).json({ error: 'Invalid token. User not found' });
        }
        
        // Add user info to request
        req.user = user;
        console.log('Auth middleware: User authenticated with ID:', user._id);
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'Token has expired. Please login again'
            });
        }
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                error: 'Invalid token. Please login again'
            });
        }

        console.error('Auth error:', error);
        res.status(401).json({ error: 'Invalid token' });
    }
};

module.exports = authMiddleware;
