/**
 * WebSocket Manager
 * 
 * This module provides a centralized interface for managing WebSocket connections
 * and broadcasting events. It implements a singleton pattern to ensure a single
 * WebSocket server instance is used throughout the application.
 * 
 * Features:
 * - WebSocket server initialization
 * - Event broadcasting
 * - User-specific messaging
 * - Connection management
 */

const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const config = require('./config');

// Singleton WebSocket server instance
let wss = null;

/**
 * Initialize WebSocket Server
 * 
 * Creates and configures a new WebSocket server instance:
 * - Sets up connection handling
 * - Configures authentication
 * - Starts heartbeat mechanism
 * 
 * @param {Object} server - HTTP server instance
 * @throws {Error} If initialization fails
 */
function initializeWebSocketServer(server) {
    try {
        wss = new WebSocket.Server({ server });
        
        wss.on('connection', (ws, req) => {
            // Set up connection health monitoring
            ws.isAlive = true;
            ws.on('pong', () => {
                ws.isAlive = true;
            });

            // Handle authentication
            const token = req.headers['sec-websocket-protocol'];
            if (!token) {
                ws.close(1008, 'Authentication required');
                return;
            }

            try {
                const decoded = jwt.verify(token, config.jwtSecret);
                ws.userId = decoded.userId;
            } catch (error) {
                console.error('Authentication error:', error);
                ws.close(1008, 'Authentication failed');
                return;
            }

            // Handle messages
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    if (data.type === 'ping') {
                        ws.send(JSON.stringify({ type: 'pong' }));
                    }
                } catch (error) {
                    console.error('Error handling message:', error);
                }
            });

            // Handle disconnection
            ws.on('close', () => {
                ws.isAlive = false;
            });
        });

        // Start heartbeat
        const interval = setInterval(() => {
            wss.clients.forEach((ws) => {
                if (ws.isAlive === false) {
                    return ws.terminate();
                }
                ws.isAlive = false;
                ws.ping();
            });
        }, 30000);

        wss.on('close', () => {
            clearInterval(interval);
        });

        console.log('WebSocket server initialized successfully');
    } catch (error) {
        console.error('Failed to initialize WebSocket server:', error);
        throw error;
    }
}

/**
 * Get WebSocket Server
 * 
 * Returns the singleton WebSocket server instance.
 * 
 * @returns {Object} WebSocket server instance
 * @throws {Error} If server hasn't been initialized
 */
function getWebSocketServer() {
    if (!wss) {
        throw new Error('WebSocket server not initialized');
    }
    return wss;
}

/**
 * Broadcast Event
 * 
 * Sends a message to all authenticated clients with an open connection.
 * 
 * @param {string} type - Event type
 * @param {Object} data - Data to broadcast
 */
function broadcastEvent(type, data) {
    if (!wss) return;

    const message = JSON.stringify({
        type,
        data,
        timestamp: new Date().toISOString()
    });

    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN && client.userId) {
            client.send(message);
        }
    });
}

/**
 * Broadcast to User
 * 
 * Sends a message to all connections belonging to a specific user.
 * 
 * @param {string} userId - Target user ID
 * @param {string} type - Event type
 * @param {Object} data - Data to broadcast
 */
function broadcastToUser(userId, type, data) {
    if (!wss) return;

    const message = JSON.stringify({
        type,
        data,
        timestamp: new Date().toISOString()
    });

    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN && 
            client.userId === userId) {
            client.send(message);
        }
    });
}

// Export functions
module.exports = {
    initializeWebSocketServer,
    getWebSocketServer,
    broadcastEvent,
    broadcastToUser
};
