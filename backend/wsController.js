/**
 * WebSocket Controller
 * 
 * This module handles WebSocket connections and message broadcasting for real-time updates.
 * It manages client connections, authentication, and message routing.
 * 
 * Features:
 * - Connection management
 * - Authentication handling
 * - Message broadcasting
 * - Error handling
 * - Heartbeat monitoring
 */

const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const config = require('./config');

/**
 * WebSocket Controller Class
 * 
 * Manages WebSocket server instance and client connections.
 * Implements singleton pattern for global access.
 */
class WebSocketController {
    constructor() {
        this.wss = null;
        this.clients = new Map();
    }

    /**
     * Initialize WebSocket Server
     * 
     * Creates and configures WebSocket server instance:
     * - Sets up connection handling
     * - Configures authentication
     * - Starts heartbeat monitoring
     * 
     * @param {Object} server - HTTP server instance
     */
    initialize(server) {
        this.wss = new WebSocket.Server({ server });

        this.wss.on('connection', (ws, req) => {
            this.handleConnection(ws, req);
        });

        this.startHeartbeat();
    }

    /**
     * Handle New Connection
     * 
     * Processes new WebSocket connections:
     * - Authenticates client
     * - Sets up message handling
     * - Configures error handling
     * - Starts connection monitoring
     * 
     * @param {WebSocket} ws - WebSocket connection
     * @param {Object} req - HTTP request
     */
    handleConnection(ws, req) {
        // Set up connection health monitoring
        ws.isAlive = true;
        ws.on('pong', () => {
            ws.isAlive = true;
        });

        // Handle incoming messages
        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                this.handleMessage(ws, data);
            } catch (error) {
                console.error('Error parsing message:', error);
                ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Invalid message format'
                }));
            }
        });

        // Handle connection close
        ws.on('close', () => {
            this.handleDisconnect(ws);
        });

        // Handle errors
        ws.on('error', (error) => {
            console.error('WebSocket error:', error);
            this.handleDisconnect(ws);
        });

        // Authenticate connection
        this.authenticateConnection(ws, req);
    }

    /**
     * Authenticate Connection
     * 
     * Validates client authentication:
     * - Extracts JWT token
     * - Verifies token validity
     * - Associates connection with user
     * 
     * @param {WebSocket} ws - WebSocket connection
     * @param {Object} req - HTTP request
     */
    authenticateConnection(ws, req) {
        try {
            const token = req.headers['sec-websocket-protocol'];
            if (!token) {
                ws.close(1008, 'Authentication required');
                return;
            }

            const decoded = jwt.verify(token, config.jwtSecret);
            ws.userId = decoded.userId;
            
            // Store connection
            if (!this.clients.has(decoded.userId)) {
                this.clients.set(decoded.userId, new Set());
            }
            this.clients.get(decoded.userId).add(ws);

            ws.send(JSON.stringify({
                type: 'auth',
                status: 'success'
            }));
        } catch (error) {
            console.error('Authentication error:', error);
            ws.close(1008, 'Authentication failed');
        }
    }

    /**
     * Handle Message
     * 
     * Processes incoming WebSocket messages:
     * - Validates message format
     * - Routes message to appropriate handler
     * - Sends response to client
     * 
     * @param {WebSocket} ws - WebSocket connection
     * @param {Object} data - Message data
     */
    handleMessage(ws, data) {
        if (!data.type) {
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Message type required'
            }));
            return;
        }

        switch (data.type) {
            case 'ping':
                ws.send(JSON.stringify({ type: 'pong' }));
                break;
            default:
                ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Unknown message type'
                }));
        }
    }

    /**
     * Handle Disconnect
     * 
     * Cleans up when client disconnects:
     * - Removes from client tracking
     * - Cleans up resources
     * 
     * @param {WebSocket} ws - WebSocket connection
     */
    handleDisconnect(ws) {
        if (ws.userId && this.clients.has(ws.userId)) {
            this.clients.get(ws.userId).delete(ws);
            if (this.clients.get(ws.userId).size === 0) {
                this.clients.delete(ws.userId);
            }
        }
    }

    /**
     * Start Heartbeat
     * 
     * Initiates connection health monitoring:
     * - Periodically checks connection health
     * - Removes stale connections
     * - Maintains connection quality
     */
    startHeartbeat() {
        setInterval(() => {
            this.wss.clients.forEach((ws) => {
                if (ws.isAlive === false) {
                    this.handleDisconnect(ws);
                    return ws.terminate();
                }
                ws.isAlive = false;
                ws.ping();
            });
        }, 30000);
    }

    /**
     * Broadcast Message
     * 
     * Sends message to all connected clients:
     * - Formats message
     * - Handles errors
     * - Ensures delivery
     * 
     * @param {Object} message - Message to broadcast
     */
    broadcast(message) {
        this.wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(message));
            }
        });
    }

    /**
     * Broadcast to User
     * 
     * Sends message to specific user's connections:
     * - Finds user's connections
     * - Sends message to each connection
     * - Handles errors
     * 
     * @param {string} userId - Target user ID
     * @param {Object} message - Message to send
     */
    broadcastToUser(userId, message) {
        if (this.clients.has(userId)) {
            this.clients.get(userId).forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(message));
                }
            });
        }
    }
}

// Export singleton instance
module.exports = new WebSocketController();
