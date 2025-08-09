/**
 * Configuration Management
 * Centralized configuration handling with environment-based overrides
 */

const config = require('config');
const logger = require('../utils/logger');

/**
 * Validate required configuration values
 */
const validateConfig = () => {
    const requiredConfigs = ['jwtSecret', 'mongoURI'];
    
    for (const configKey of requiredConfigs) {
        if (!config.has(configKey) || !config.get(configKey)) {
            throw new Error(`Required configuration missing: ${configKey}`);
        }
    }
    
    // Validate JWT secret strength
    const jwtSecret = config.get('jwtSecret');
    if (jwtSecret.length < 32) {
        logger.warn('JWT secret should be at least 32 characters long for security');
    }
    
    logger.info('Configuration validation passed');
};

/**
 * Get database configuration
 */
const getDatabaseConfig = () => {
    return {
        uri: config.get('mongoURI'),
        options: {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            maxPoolSize: config.get('database.maxPoolSize') || 10,
            serverSelectionTimeoutMS: config.get('database.serverSelectionTimeoutMS') || 5000,
            socketTimeoutMS: config.get('database.socketTimeoutMS') || 45000,
        }
    };
};

/**
 * Get JWT configuration
 */
const getJWTConfig = () => {
    return {
        secret: config.get('jwtSecret'),
        expiresIn: config.get('jwt.expiresIn') || '24h',
        algorithm: config.get('jwt.algorithm') || 'HS256'
    };
};

/**
 * Get server configuration
 */
const getServerConfig = () => {
    return {
        port: config.get('port') || process.env.PORT || 5000,
        nodeEnv: process.env.NODE_ENV || 'development',
        corsOrigin: config.get('server.corsOrigin') || ['http://localhost:3000']
    };
};

/**
 * Get WebSocket configuration
 */
const getWebSocketConfig = () => {
    return {
        heartbeatInterval: config.get('websocket.heartbeatInterval') || 30000,
        reconnectInterval: config.get('websocket.reconnectInterval') || 5000
    };
};

module.exports = {
    validateConfig,
    getDatabaseConfig,
    getJWTConfig,
    getServerConfig,
    getWebSocketConfig,
    
    // Direct access to config for backward compatibility
    get: (key) => config.get(key),
    has: (key) => config.has(key)
};