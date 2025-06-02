/**
 * FinTrack Backend Server
 * This is the main server file that sets up the Express application, middleware,
 * routes, and handles server initialization.
 */

// Import required dependencies
const dotenv = require('dotenv');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');

// Configure environment variables
const dotenvPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: dotenvPath });

console.log('Environment variables loaded. MONGODB_URI:', process.env.MONGODB_URI);

// Import database connection and models
const { connectDB } = require('./db');
const User = require('./models/User');
const Transaction = require('./models/Transaction');
const SavingsGoal = require('./models/SavingsGoal');
const Budget = require('./models/Budget');

// Import route handlers
const authRoutes = require('./routes/auth');
const transactionRoutes = require('./routes/transaction');
const budgetRoutes = require('./routes/budget');
const savingsRoutes = require('./routes/savings');

// Import WebSocket related modules
const http = require('http');
const { initializeWebSocketServer } = require('./websocketManager');

// Initialize Express application
const app = express();

// Security and Performance Middleware Configuration
// Note: Helmet is temporarily disabled for troubleshooting
app.use(compression());

/**
 * Rate Limiting Configuration
 * Limits each IP to 100 requests per 15-minute window to prevent abuse
 */
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

/**
 * CORS Configuration
 * Configures Cross-Origin Resource Sharing based on environment
 * Production: Allows specific domains
 * Development: Allows localhost
 */
const corsOptions = {
    origin: process.env.NODE_ENV === 'production'
        ? [process.env.FRONTEND_URL, 'https://fintrack-app.vercel.app', 'https://fintrack-git-main-mallamteja-projects.vercel.app']
        : ['http://localhost:5000', 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Range', 'X-Content-Range']
};
app.use(cors(corsOptions));

// Body parsing middleware with size limits
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Serve static files from the frontend public directory
app.use(express.static(path.join(__dirname, '../frontend/public')));

// API Route Registration
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/savings-goals', savingsRoutes);

/**
 * API Documentation Route
 * Provides information about available API endpoints and their methods
 */
app.get('/api', (req, res) => {
    res.json({
        name: 'FinTrack API',
        version: '1.0.0',
        endpoints: {
            auth: {
                register: 'POST /api/auth/register',
                login: 'POST /api/auth/login',
                me: 'GET /api/auth/me',
                preferences: 'PUT /api/auth/preferences'
            },
            transactions: {
                list: 'GET /api/transactions',
                create: 'POST /api/transactions',
                update: 'PUT /api/transactions/:id',
                delete: 'DELETE /api/transactions/:id'
            },
            budgets: {
                list: 'GET /api/budgets',
                create: 'POST /api/budgets',
                update: 'PUT /api/budgets/:id',
                delete: 'DELETE /api/budgets/:id'
            },
            savingsGoals: {
                list: 'GET /api/savings-goals',
                create: 'POST /api/savings-goals',
                update: 'PUT /api/savings-goals/:id',
                delete: 'DELETE /api/savings-goals/:id'
            }
        }
    });
});

/**
 * HTML File Routes
 * Serves HTML files for different pages of the application
 */
const htmlFiles = ['insights', 'dashboard', 'login', 'register', 'settings'];
htmlFiles.forEach(file => {
    app.get(`/${file}.html`, (req, res) => {
        res.sendFile(path.join(__dirname, '../frontend/public', `${file}.html`));
    });
});

// Root route handler - redirects to login page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public', 'login.html'));
});

/**
 * Global Error Handling Middleware
 * Handles all uncaught errors and provides appropriate error responses
 */
app.use((err, req, res, next) => {
    console.error(err.stack);
    
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    
    res.status(statusCode).json({
        error: message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

/**
 * 404 Error Handler
 * Handles requests to undefined routes
 */
app.use((req, res) => {
    res.status(404).json({
        error: 'Route not found'
    });
});

/**
 * Server Initialization Function
 * Connects to MongoDB and starts HTTP and WebSocket servers
 */
const startServer = async () => {
    try {
        await connectDB();
        const PORT = process.env.PORT || 5000;
        const mode = process.env.NODE_ENV || 'development';

        // Create HTTP server from Express app
        const server = http.createServer(app);

        // Initialize WebSocket server with HTTP server
        initializeWebSocketServer(server);

        // Start listening on the HTTP server
        server.listen(PORT, () => {
            console.log(`Server running in ${mode} mode on port ${PORT}`);
            console.log(`API URL: http://localhost:${PORT}/api`);
        });
    } catch (err) {
        console.error('Failed to connect to database:', err);
        process.exit(1);
    }
};

// Start server only if this file is run directly
if (require.main === module) {
    startServer();
}

// Export the Express app for Vercel serverless function
module.exports = app;
