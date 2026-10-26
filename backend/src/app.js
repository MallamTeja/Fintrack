// Express app: security middleware, the JSON API and the static frontend.
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { config } = require('./config');
const { notFound, errorHandler } = require('./http');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // Vercel sits in front: rate limits must see the real client IP

app.use(
    helmet({
        // The legacy pages use inline scripts and CDN assets; a strict CSP would break them.
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false,
    })
);
app.use(
    cors({
        origin(origin, cb) {
            // Same-origin requests have no Origin header; others must be allow-listed via FRONTEND_URL.
            cb(null, !origin || config.allowedOrigins.includes(origin));
        },
    })
);
app.use(compression());
app.use(express.json({ limit: '50kb' }));

if (config.nodeEnv !== 'test') {
    const limiter = (max) =>
        rateLimit({
            windowMs: 15 * 60 * 1000,
            limit: max,
            standardHeaders: 'draft-7',
            legacyHeaders: false,
            message: { success: false, error: { message: 'Too many requests, please try again later' } },
        });
    app.use('/api', limiter(300));
    app.use(['/api/auth/login', '/api/auth/register', '/api/auth/refresh'], limiter(20));
}

app.get('/api/health', (req, res) => res.json({ success: true, status: 'ok', time: new Date().toISOString() }));

const savings = require('./routes/savings');
app.use('/api/auth', require('./routes/auth'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/budgets', require('./routes/budgets'));
app.use('/api/savings-goals', savings);
app.use('/api/savings', savings);
app.use('/api', notFound);

// Static pages (frontend/public). Unknown non-API paths fall back to the login page.
const publicDir = path.join(__dirname, '..', '..', 'frontend', 'public');
app.use(express.static(publicDir, { extensions: ['html'], maxAge: config.nodeEnv === 'production' ? '1h' : 0 }));
app.get('*', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));

app.use(errorHandler);

module.exports = app;
