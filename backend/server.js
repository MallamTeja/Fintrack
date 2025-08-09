/**
 * FinTrack Server
 * 
 * Main server file for the FinTrack application. Handles HTTP requests,
 * WebSocket connections, and database operations.
 * 
 * Features:
 * - Express server setup
 * - Middleware configuration
 * - API route handling
 * - WebSocket integration
 * - Database connection
 * - Centralized error handling
 */

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const http = require('http');
const config = require('./config');
const websocketManager = require('./websocketManager');
const { globalErrorHandler } = require('./utils/errorHandler');
const logger = require('./utils/logger');

// Create Express application
const app = express();

/**
 * Middleware Configuration
 * 
 * Sets up security and performance middleware:
 * - CORS for cross-origin requests
 * - Helmet for security headers
 * - Compression for response size
 * - Rate limiting for API protection
 * - JSON and URL-encoded body parsing
 */
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://fintrack-five-pink.vercel.app'] 
        : ['http://localhost:3000', 'http://localhost:5000'],
    credentials: true
}));

app.use(helmet({
    crossOriginEmbedderPolicy: false
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting configuration
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
        error: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/api/', limiter);

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // limit each IP to 10 auth requests per windowMs
    message: {
        error: 'Too many authentication attempts, please try again later.'
    }
});
app.use('/api/auth', authLimiter);

/**
 * API Routes Configuration
 * 
 * Sets up route handlers for:
 * - Authentication
 * - Transactions
 * - Budgets
 * - Savings goals
 */
app.use('/api/auth', require('./routes/auth'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/budgets', require('./routes/budgets'));
app.use('/api/savings', require('./routes/savings'));

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

/**
 * Error Handling Middleware
 * 
 * Handles different types of errors:
 * - 404 Not Found
 * - Centralized error handling
 */
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: {
            message: 'The requested resource was not found',
            type: 'NotFound'
        }
    });
});

// Global error handling middleware
app.use(globalErrorHandler);

/**
 * Server Initialization
 * 
 * Sets up and starts the server:
 * 1. Connects to MongoDB
 * 2. Creates HTTP server
 * 3. Initializes WebSocket server
 * 4. Starts listening on configured port
 */
async function startServer() {
    try {
        // Connect to MongoDB
        await mongoose.connect(config.get('mongoURI'), {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        logger.info('Connected to MongoDB');

        // Create HTTP server
        const server = http.createServer(app);

        // Initialize WebSocket server
        websocketManager.initializeWebSocketServer(server);
        logger.info('WebSocket server initialized');

        // Start listening
        const port = config.get('port') || 3000;
        server.listen(port, () => {
            logger.info(`Server running on port ${port}`);
            logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
        });

        // Graceful shutdown handling
        process.on('SIGTERM', () => {
            logger.info('SIGTERM received, shutting down gracefully');
            server.close(() => {
                mongoose.connection.close();
                process.exit(0);
            });
        });

        process.on('SIGINT', () => {
            logger.info('SIGINT received, shutting down gracefully');
            server.close(() => {
                mongoose.connection.close();
                process.exit(0);
            });
        });

    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    logger.error('Unhandled Promise Rejection:', err);
    process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err);
    process.exit(1);
});

// Start the server
startServer();
