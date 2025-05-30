/**
 * WebSocket Controller for FinTrack
 * 
 * Handles WebSocket connections, authentication, and message broadcasting.
 * Provides real-time updates for transactions, budgets, and savings goals.
 */

const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Get JWT secret from environment
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Initialize WebSocket server
 * @param {Object} server - HTTP server instance
 * @returns {Object} WebSocket server instance
 */
function initializeWebSocketServer(server) {
  console.log('Initializing WebSocket server...');
  
  // Create WebSocket server
  const wss = new WebSocket.Server({ server });
  
  // Connection event
  wss.on('connection', function connection(ws, req) {
    console.log('[WS] Client connected');
    
    // Set initial authentication state
    ws.authenticated = false;
    // Initialize heartbeat flag and pong handler
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });
    
    // Handle incoming messages
    ws.on('message', function incoming(message) {
      try {
        // Parse message
        const data = JSON.parse(message);
        console.log('[WS] Received message:', data.type);
        
        // Handle authentication
        if (data.type === 'authenticate') {
          handleAuthentication(ws, data.token);
          return;
        }
        
        // Check if client is authenticated for other message types
        if (!ws.authenticated) {
          ws.send(JSON.stringify({ 
            type: 'error', 
            payload: { message: 'Not authenticated' } 
          }));
          return;
        }
        
        // Handle other message types
        switch (data.type) {
          case 'addTransaction':
            broadcastToAuthenticated(wss, {
              type: 'transaction:added',
              payload: data.payload
            });
            break;
            
          case 'updateTransaction':
            broadcastToAuthenticated(wss, {
              type: 'transaction:updated',
              payload: data.payload
            });
            break;
            
          case 'deleteTransaction':
            broadcastToAuthenticated(wss, {
              type: 'transaction:deleted',
              payload: data.payload
            });
            break;

          case 'addBudget':
            broadcastToAuthenticated(wss, {
              type: 'budget:added',
              payload: data.payload
            });
            break;

          case 'updateBudget':
            broadcastToAuthenticated(wss, {
              type: 'budget:updated',
              payload: data.payload
            });
            break;

          case 'deleteBudget':
            broadcastToAuthenticated(wss, {
              type: 'budget:deleted',
              payload: data.payload
            });
            break;

          case 'addSavingsGoal':
            broadcastToAuthenticated(wss, {
              type: 'savingsGoal:added',
              payload: data.payload
            });
            break;

          case 'updateSavingsGoal':
            broadcastToAuthenticated(wss, {
              type: 'savingsGoal:updated',
              payload: data.payload
            });
            break;

          case 'deleteSavingsGoal':
            broadcastToAuthenticated(wss, {
              type: 'savingsGoal:deleted',
              payload: data.payload
            });
            break;
            
          case 'ping':
            ws.send(JSON.stringify({ type: 'pong' }));
            break;
            
          default:
            console.log('[WS] Unknown message type:', data.type);
        }
      } catch (error) {
        console.error('[WS] Error handling message:', error);
        ws.send(JSON.stringify({ 
          type: 'error', 
          payload: { message: 'Invalid message format' } 
        }));
      }
    });
    
    // Handle close event
    ws.on('close', function close() {
      console.log('[WS] Client disconnected');
    });
    
    // Handle error event
    ws.on('error', function error(err) {
      console.error('[WS] Connection error:', err);
    });
    
    // Send welcome message
    ws.send(JSON.stringify({ 
      type: 'welcome', 
      payload: { message: 'Welcome to FinTrack WebSocket Server' } 
    }));
  });
  
  // Start heartbeat to keep connections alive
  const interval = setInterval(function ping() {
    wss.clients.forEach(function each(ws) {
      if (ws.isAlive === false) return ws.terminate();
      
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);
  
  // Handle server close
  wss.on('close', function close() {
    clearInterval(interval);
  });
  
  console.log('WebSocket server initialized');
  return wss;
}

/**
 * Handle authentication
 * @param {Object} ws - WebSocket connection
 * @param {string} token - JWT token
 */
function handleAuthentication(ws, token) {
  if (!token) {
    ws.send(JSON.stringify({ 
      type: 'unauthorized', 
      payload: { message: 'No token provided' } 
    }));
    return;
  }
  
  try {
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Set authenticated state and user ID
    ws.authenticated = true;
    ws.userId = decoded.userId || decoded.id;
    
    // Send authenticated message
    ws.send(JSON.stringify({ 
      type: 'authenticated', 
      payload: { userId: ws.userId } 
    }));
    
    console.log(`[WS] Client authenticated: ${ws.userId}`);
  } catch (error) {
    console.error('[WS] Authentication error:', error);
    
    // Send unauthorized message
    ws.send(JSON.stringify({ 
      type: 'unauthorized', 
      payload: { message: 'Invalid token' } 
    }));
  }
}

/**
 * Broadcast message to all authenticated clients
 * @param {Object} wss - WebSocket server
 * @param {Object} message - Message to broadcast
 */
function broadcastToAuthenticated(wss, message) {
  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN && client.authenticated) {
      client.send(JSON.stringify(message));
    }
  });
}

/**
 * Broadcast message to specific user
 * @param {Object} wss - WebSocket server
 * @param {string} userId - User ID
 * @param {Object} message - Message to broadcast
 */
function broadcastToUser(wss, userId, message) {
  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN && 
        client.authenticated && 
        client.userId === userId) {
      client.send(JSON.stringify(message));
    }
  });
}

// Export functions
module.exports = {
  initializeWebSocketServer,
  broadcastToAuthenticated,
  broadcastToUser
};
