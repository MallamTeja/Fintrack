/**
 * WebSocket Service
 * 
 * A consolidated service that manages all WebSocket connections 
 * and real-time data broadcasting for the application.
 */
const WebSocket = require('ws');
const EventEmitter = require('events');

// Models and data sources
const { getLatestDashboardData } = require('../models/dashboard');

class WebSocketService extends EventEmitter {
  constructor() {
    super();
    this.server = null;
    this.clients = new Map(); // Maps clients to their metadata
    this.updateIntervals = new Map(); // Tracks all active update intervals
  }

  /**
   * Initialize the WebSocket server with an HTTP server instance
   * @param {Object} httpServer - The HTTP server to attach to
   */
  initialize(httpServer) {
    this.server = new WebSocket.Server({ server: httpServer });
    
    this.server.on('connection', (ws, request) => {
      this.handleConnection(ws, request);
    });
    
    console.log('WebSocket service initialized');
    return this;
  }

  /**
   * Handle a new WebSocket connection
   * @param {WebSocket} ws - The WebSocket connection
   * @param {Object} request - The HTTP request that initiated the connection
   */
  handleConnection(ws, request) {
    // Parse connection URL to determine what type of connection this is
    const url = new URL(request.url, `http://${request.headers.host}`);
    const clientType = url.pathname.split('/').filter(Boolean)[0] || 'general';
    
    // Set up client metadata
    const clientId = this.generateClientId();
    const clientInfo = {
      id: clientId,
      type: clientType,
      connectedAt: new Date(),
      lastActivity: new Date()
    };
    
    // Store client
    this.clients.set(ws, clientInfo);
    console.log(`Client connected: ${clientId} (${clientType})`);
    
    // Set up event handlers for this client
    this.setupClientHandlers(ws, clientInfo);
    
    // Send connection confirmation
    this.sendToClient(ws, {
      type: 'connection_established',
      clientId: clientId,
      message: `Connected to ${clientType} service`,
      timestamp: new Date().toISOString()
    });
    
    // Start data updates if this is a dashboard client
    if (clientType === 'dashboard') {
      this.startDashboardUpdates(ws, clientInfo);
    }
    
    // Emit connection event for other parts of the application
    this.emit('connection', { ws, clientInfo });
  }

  /**
   * Set up event handlers for a client connection
   * @param {WebSocket} ws - The WebSocket connection
   * @param {Object} clientInfo - Metadata about the client
   */
  setupClientHandlers(ws, clientInfo) {
    ws.on('message', (message) => {
      this.handleClientMessage(ws, message, clientInfo);
    });
    
    ws.on('close', () => {
      this.handleClientDisconnect(ws, clientInfo);
    });
    
    ws.on('error', (error) => {
      console.error(`WebSocket error for client ${clientInfo.id}:`, error);
      this.emit('client_error', { clientInfo, error });
    });
  }

  /**
   * Handle a message from a client
   * @param {WebSocket} ws - The WebSocket connection
   * @param {String|Buffer} message - The message from the client
   * @param {Object} clientInfo - Metadata about the client
   */
  async handleClientMessage(ws, message, clientInfo) {
    try {
      // Update last activity time
      clientInfo.lastActivity = new Date();
      this.clients.set(ws, clientInfo);
      
      // Parse the message
      const parsedMessage = JSON.parse(message);
      
      // Log activity
      console.log(`Message from ${clientInfo.id} (${clientInfo.type}): ${parsedMessage.type}`);
      
      // Handle based on client type and message type
      switch (clientInfo.type) {
        case 'dashboard':
          await this.handleDashboardMessage(ws, parsedMessage, clientInfo);
          break;
          
        // Add other client types as needed
        default:
          this.emit('message', { clientInfo, message: parsedMessage });
      }
    } catch (error) {
      console.error(`Error handling message from ${clientInfo.id}:`, error);
      this.sendToClient(ws, {
        type: 'error',
        message: 'Error processing your request',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle messages specific to dashboard clients
   * @param {WebSocket} ws - The WebSocket connection
   * @param {Object} message - The parsed message
   * @param {Object} clientInfo - Metadata about the client
   */
  async handleDashboardMessage(ws, message, clientInfo) {
    switch (message.type) {
      case 'initial_data_request':
        await this.sendDashboardData(ws, clientInfo);
        break;
        
      case 'sync_request':
        await this.sendDashboardData(ws, clientInfo);
        break;
        
      case 'force_refresh':
        await this.sendDashboardData(ws, clientInfo, true);
        break;
        
      default:
        this.sendToClient(ws, {
          type: 'error',
          message: 'Unknown dashboard request type',
          timestamp: new Date().toISOString()
        });
    }
  }

  /**
   * Handle a client disconnection
   * @param {WebSocket} ws - The WebSocket connection
   * @param {Object} clientInfo - Metadata about the client
   */
  handleClientDisconnect(ws, clientInfo) {
    // Stop any intervals for this client
    if (this.updateIntervals.has(clientInfo.id)) {
      clearInterval(this.updateIntervals.get(clientInfo.id));
      this.updateIntervals.delete(clientInfo.id);
    }
    
    // Remove client from active clients
    this.clients.delete(ws);
    
    console.log(`Client disconnected: ${clientInfo.id} (${clientInfo.type})`);
    this.emit('disconnect', { clientInfo });
  }

  /**
   * Start regular dashboard updates for a client
   * @param {WebSocket} ws - The WebSocket connection
   * @param {Object} clientInfo - Metadata about the client
   */
  startDashboardUpdates(ws, clientInfo) {
    // Stop any existing interval
    if (this.updateIntervals.has(clientInfo.id)) {
      clearInterval(this.updateIntervals.get(clientInfo.id));
    }
    
    // Create a new interval
    const interval = setInterval(async () => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          await this.sendDashboardData(ws, clientInfo);
        } catch (error) {
          console.error(`Error sending dashboard update to ${clientInfo.id}:`, error);
        }
      } else {
        // WebSocket is no longer open, clear the interval
        clearInterval(interval);
        this.updateIntervals.delete(clientInfo.id);
      }
    }, 1000); // Update every second
    
    // Store the interval
    this.updateIntervals.set(clientInfo.id, interval);
  }

  /**
   * Send dashboard data to a client
   * @param {WebSocket} ws - The WebSocket connection
   * @param {Object} clientInfo - Metadata about the client
   * @param {Boolean} forceRefresh - Whether to force a data refresh
   */
  async sendDashboardData(ws, clientInfo, forceRefresh = false) {
    try {
      const dashboardData = await getLatestDashboardData(forceRefresh);
      
      this.sendToClient(ws, {
        type: 'data_update',
        data: dashboardData,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`Error sending dashboard data to ${clientInfo.id}:`, error);
      this.sendToClient(ws, {
        type: 'error',
        message: 'Unable to retrieve dashboard data',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Send a message to a specific client
   * @param {WebSocket} ws - The WebSocket connection
   * @param {Object} data - The data to send
   */
  sendToClient(ws, data) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  /**
   * Broadcast a message to all clients of a specific type
   * @param {String} clientType - The type of clients to send to (e.g., 'dashboard')
   * @param {Object} data - The data to send
   */
  broadcast(clientType, data) {
    const message = JSON.stringify(data);
    
    this.clients.forEach((clientInfo, ws) => {
      if (clientInfo.type === clientType && ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }

  /**
   * Generate a unique client ID
   * @returns {String} A unique ID
   */
  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get the number of connected clients, optionally filtered by type
   * @param {String} clientType - Optional filter for client type
   * @returns {Number} The count of connected clients
   */
  getClientCount(clientType) {
    if (clientType) {
      let count = 0;
      this.clients.forEach(info => {
        if (info.type === clientType) count++;
      });
      return count;
    }
    return this.clients.size;
  }

  /**
   * Shutdown the WebSocket service
   */
  shutdown() {
    // Clear all intervals
    this.updateIntervals.forEach(interval => clearInterval(interval));
    this.updateIntervals.clear();
    
    // Close all connections
    this.clients.forEach((clientInfo, ws) => {
      ws.close(1000, 'Server shutting down');
    });
    
    // Close the server
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    
    console.log('WebSocket service shut down');
  }
}

// Create and export a singleton instance
const websocketService = new WebSocketService();
module.exports = websocketService;