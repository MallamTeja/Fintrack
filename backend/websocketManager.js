/**
 * WebSocket Manager - Initializes and manages the WebSocket server
 * Provides methods for emitting events to connected clients
 */

const WebSocketServer = require('./websocket');

let wsServer = null;

/**
 * Initialize WebSocket server
 * @param {Object} httpServer - HTTP server instance
 * @returns {Object} WebSocket server instance
 */
function initializeWebSocketServer(httpServer) {
  if (wsServer) {
    return wsServer;
  }
  
  wsServer = new WebSocketServer(httpServer);
  wsServer.startHeartbeat();
  
  console.log('WebSocket server initialized');
  
  return wsServer;
}

/**
 * Get WebSocket server instance
 * @returns {Object} WebSocket server instance
 */
function getWebSocketServer() {
  if (!wsServer) {
    throw new Error('WebSocket server not initialized');
  }
  
  return wsServer;
}

/**
 * Broadcast event to all connected clients
 * @param {string} event - Event name
 * @param {Object} data - Event data
 */
function broadcastEvent(event, data) {
  if (!wsServer) {
    console.warn('WebSocket server not initialized, cannot broadcast event');
    return;
  }
  
  wsServer.broadcast({
    event,
    data
  });
  
  console.log(`Broadcasted event: ${event}`);
}

/**
 * Broadcast event to specific user
 * @param {string} userId - User ID
 * @param {string} event - Event name
 * @param {Object} data - Event data
 */
function broadcastToUser(userId, event, data) {
  if (!wsServer) {
    console.warn('WebSocket server not initialized, cannot broadcast event to user');
    return;
  }
  
  wsServer.broadcastToUser(userId, {
    event,
    data
  });
  
  console.log(`Broadcasted event: ${event} to user: ${userId}`);
}

module.exports = {
  initializeWebSocketServer,
  getWebSocketServer,
  broadcastEvent,
  broadcastToUser
};
