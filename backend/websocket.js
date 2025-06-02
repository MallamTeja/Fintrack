/**
 * WebSocket Server Implementation
 * This module implements a WebSocket server with authentication, heartbeat mechanism,
 * and broadcasting capabilities for real-time communication.
 */

const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const config = require('config');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Get JWT secret from config or environment variable
const JWT_SECRET = process.env.JWT_SECRET || config.get('jwtSecret');

/**
 * WebSocketServer Class
 * Manages WebSocket connections, authentication, and message handling
 */
class WebSocketServer {
    /**
     * Constructor - Initializes WebSocket server and client tracking
     * @param {Object} server - HTTP server instance
     */
    constructor(server) {
        this.wss = new WebSocket.Server({ server });
        this.clients = new Map(); // Maps WebSocket connections to user IDs

        this.wss.on('connection', (ws, req) => {
            this.handleConnection(ws, req);
        });
    }

    /**
     * Handles new WebSocket connections
     * Sets up event listeners for messages, pong responses, and connection closure
     * @param {Object} ws - WebSocket connection
     * @param {Object} req - HTTP request object
     */
    handleConnection(ws, req) {
        ws.isAlive = true;

        // Handle pong responses for heartbeat mechanism
        ws.on('pong', () => {
            ws.isAlive = true;
        });

        // Handle incoming messages
        ws.on('message', async (message) => {
            try {
                const data = JSON.parse(message);
                const { type, token, payload } = data;

                // Verify JWT token
                if (!token) {
                    ws.send(JSON.stringify({ type: 'error', message: 'No token provided' }));
                    return;
                }

                try {
                    const decoded = jwt.verify(token, JWT_SECRET);
                    const userId = decoded.user ? decoded.user.id : decoded.id;

                    // Store user ID with WebSocket connection
                    this.clients.set(ws, userId);

                    // Handle different message types
                    switch (type) {
                        case 'subscribe':
                            // Handle subscription
                            break;
                        default:
                            ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
                    }
                } catch (err) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Invalid token' }));
                }
            } catch (err) {
                ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
            }
        });

        // Clean up when connection closes
        ws.on('close', () => {
            this.clients.delete(ws);
        });
    }

    /**
     * Broadcasts a message to all connected clients
     * @param {Object} data - Data to broadcast
     */
    broadcast(data) {
        this.wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(data));
            }
        });
    }

    /**
     * Broadcasts a message to a specific user
     * @param {string} userId - ID of the user to broadcast to
     * @param {Object} data - Data to broadcast
     */
    broadcastToUser(userId, data) {
        this.wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN && this.clients.get(client) === userId) {
                client.send(JSON.stringify(data));
            }
        });
    }

    /**
     * Starts the heartbeat mechanism to detect and clean up stale connections
     * Checks connection health every 30 seconds by default
     */
    startHeartbeat() {
        setInterval(() => {
            this.wss.clients.forEach((ws) => {
                if (!ws.isAlive) {
                    this.clients.delete(ws);
                    return ws.terminate();
                }
                ws.isAlive = false;
                ws.ping();
            });
        }, config.get('websocket.heartbeatInterval') || 30000);
    }
}

module.exports = WebSocketServer;
