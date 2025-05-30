const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const config = require('config');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Get JWT secret from config or environment variable
const JWT_SECRET = process.env.JWT_SECRET || config.get('jwtSecret');

class WebSocketServer {
    constructor(server) {
        this.wss = new WebSocket.Server({ server });
        this.clients = new Map();

        this.wss.on('connection', (ws, req) => {
            this.handleConnection(ws, req);
        });
    }

    handleConnection(ws, req) {
        ws.isAlive = true;

        ws.on('pong', () => {
            ws.isAlive = true;
        });

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

        ws.on('close', () => {
            this.clients.delete(ws);
        });
    }

    // Broadcast to all connected clients
    broadcast(data) {
        this.wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(data));
            }
        });
    }

    // Broadcast to specific user
    broadcastToUser(userId, data) {
        this.wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN && this.clients.get(client) === userId) {
                client.send(JSON.stringify(data));
            }
        });
    }

    // Start heartbeat to check for stale connections
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
