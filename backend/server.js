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
 * - Error handling
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
app.use(cors());
app.use(helmet());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting configuration
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

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

/**
 * Error Handling Middleware
 * 
 * Handles different types of errors:
 * - 404 Not Found
 * - 500 Server Error
 * - Validation errors
 * - Authentication errors
 */
app.use((req, res, next) => {
    res.status(404).json({
        error: 'Not Found',
        message: 'The requested resource was not found'
    });
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        error: err.name || 'Server Error',
        message: err.message || 'An unexpected error occurred'
    });
});

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
        await mongoose.connect(config.mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB');

        // Create HTTP server
        const server = http.createServer(app);

        // Initialize WebSocket server
        websocketManager.initializeWebSocketServer(server);

        // Start listening
        const port = config.port || 3000;
        server.listen(port, () => {
            console.log(`Server running on port ${port}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Start the server
startServer();
