const dotenv = require('dotenv');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');

const dotenvPath = path.resolve(__dirname, '../.env');
// Load environment variables
dotenv.config({ path: dotenvPath });

console.log('Environment variables loaded. MONGODB_URI:', process.env.MONGODB_URI);

// Import database connection and models
const { connectDB } = require('./db');
const User = require('./models/User');
const Transaction = require('./models/Transaction');
const SavingsGoal = require('./models/SavingsGoal');
const Budget = require('./models/Budget');

// Import routes
const authRoutes = require('./routes/auth');
const transactionRoutes = require('./routes/transaction');
const budgetRoutes = require('./routes/budget');
const savingsRoutes = require('./routes/savings');

const http = require('http');
const { initializeWebSocketServer } = require('./websocketManager');

const app = express();

// Security middleware
// Temporarily disable Helmet to troubleshoot blank page issue
// app.use(helmet({
//     contentSecurityPolicy: {
//         directives: {
//             defaultSrc: ["'self'"],
//             scriptSrc: ["'self'", "'unsafe-inline'", "cdnjs.cloudflare.com"],
//             styleSrc: ["'self'", "'unsafe-inline'", "cdnjs.cloudflare.com"],
//             imgSrc: ["'self'", "data:"],
//             connectSrc: ["'self'"],
//             fontSrc: ["'self'", "cdnjs.cloudflare.com"],
//             objectSrc: ["'none'"],
//             mediaSrc: ["'self'"],
//             frameSrc: ["'none'"],
//         },
//     },
// }));
app.use(compression());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// CORS configuration
const corsOptions = {
    origin: process.env.NODE_ENV === 'production'
        ? [process.env.FRONTEND_URL, 'https://fintrack-app.vercel.app']
        : ['http://localhost:5000', 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Range', 'X-Content-Range']
};
app.use(cors(corsOptions));

// Body parser middleware
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Serve static files
app.use(express.static(path.join(__dirname, '../frontend/public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/savings-goals', savingsRoutes);

// API Documentation route
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

// Serve HTML files
const htmlFiles = ['insights', 'dashboard', 'login', 'register', 'settings'];
htmlFiles.forEach(file => {
    app.get(`/${file}.html`, (req, res) => {
        res.sendFile(path.join(__dirname, '../frontend/public', `${file}.html`));
    });
});

// Add root route handler
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public', 'login.html'));
});

// Global error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    
    res.status(statusCode).json({
        error: message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

// Handle 404 errors
app.use((req, res) => {
    res.status(404).json({
        error: 'Route not found'
    });
});

// Connect to MongoDB and start HTTP and WebSocket servers
connectDB()
    .then(() => {
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
    })
    .catch(err => {
        console.error('Failed to connect to database:', err);
        process.exit(1);
    });

// Export the Express app for Vercel serverless function
module.exports = app;
