/**
 * WebSocketService - Handles real-time communication with the backend
 * 
 * Features:
 * - Connection management with auto-reconnect and exponential backoff
 * - Event-based architecture with pub/sub pattern
 * - Integration with state management system
 * - Message queuing for offline/reconnection scenarios
 * - Authentication support via JWT
 * - Heartbeat mechanism to detect connection issues
 */

import { store } from '../state/index.js';

class WebSocketService {
  constructor() {
    // Singleton pattern
    if (WebSocketService.instance) {
      return WebSocketService.instance;
    }
    
    WebSocketService.instance = this;
    
    // WebSocket connection
    this.socket = null;
    this.url = 'ws://localhost:5000';
    this.status = 'disconnected'; // 'connected', 'connecting', 'disconnected', 'error'
    
    // Authentication
    this.token = null;
    
    // Reconnection settings
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000; // Starting delay in ms
    this.reconnectTimer = null;
    this.reconnectBackoffRate = 1.5; // Exponential backoff multiplier
    
    // Event handlers
    this.eventHandlers = new Map();
    this.persistentHandlers = new Map(); // Handlers that persist across reconnections
    
    // Message queue for offline/reconnection scenarios
    this.messageQueue = [];
    this.maxQueueSize = 100;
    
    // Heartbeat mechanism
    this.heartbeatInterval = 30000; // 30 seconds
    this.heartbeatTimer = null;
    this.missedHeartbeats = 0;
    this.maxMissedHeartbeats = 3;
    
    // Debug mode
    this.debug = false;
  }
  
  /**
   * Set authentication token
   * @param {string} token - JWT token
   */
  setToken(token) {
    this.token = token;
    this.log('Token set');
    
    // Store token in memory for reconnection
    if (token) {
      // Don't store in localStorage here - that should be handled by auth service
      this.log('Token stored for WebSocket authentication');
    }
    
    // If already connected, disconnect and reconnect with new token
    if (this.isConnected()) {
      this.log('Reconnecting with new token...');
      this.disconnect();
      this.connect();
    } else {
      // If not connected, try to connect with the new token
      this.log('Connecting with new token...');
      this.connect();
    }
  }
  
  /**
   * Set WebSocket server URL
   * @param {string} url - WebSocket server URL
   */
  setUrl(url) {
    this.url = url;
    this.log(`URL set to ${url}`);
  }
  
  /**
   * Enable or disable debug mode
   * @param {boolean} enabled - Whether debug mode is enabled
   */
  setDebug(enabled) {
    this.debug = enabled;
  }
  
  /**
   * Log message if debug mode is enabled
   * @param {string} message - Message to log
   * @param {*} data - Optional data to log
   */
  log(message, data) {
    if (this.debug) {
      if (data) {
        console.log(`[WebSocket] ${message}`, data);
      } else {
        console.log(`[WebSocket] ${message}`);
      }
    }
  }
  
  /**
   * Check if socket is connected
   * @returns {boolean} Whether socket is connected
   */
  isConnected() {
    return this.socket && this.socket.readyState === WebSocket.OPEN;
  }
  
  /**
   * Connect to WebSocket server
   * @returns {Promise} Promise that resolves when connected
   */
  connect() {
    return new Promise((resolve, reject) => {
      if (this.isConnected()) {
        this.log('Already connected');
        resolve();
        return;
      }
      
      // Update status and notify subscribers
      this.status = 'connecting';
      this.log(`Connecting to ${this.url}`);
      store.dispatch('websocket:statusChanged', { status: 'connecting' });
      
      try {
        // Create WebSocket connection
        this.socket = new WebSocket(this.url);
        
        // Set a connection timeout
        const connectionTimeout = setTimeout(() => {
          if (this.status === 'connecting') {
            this.log('Connection timeout');
            this.status = 'error';
            store.dispatch('websocket:statusChanged', { 
              status: 'error', 
              error: 'Connection timeout' 
            });
            reject(new Error('Connection timeout'));
            
            // Try to reconnect
            this.attemptReconnect();
          }
        }, 5000); // 5 second timeout
        
        // Connection opened
        this.socket.onopen = () => {
          // Clear connection timeout
          clearTimeout(connectionTimeout);
          
          this.status = 'connected';
          this.log('Connected');
          store.dispatch('websocket:statusChanged', { status: 'connected' });
          
          // Reset reconnection settings
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000;
          
          // Clear any existing reconnect timer
          if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
          }
          
          // Authenticate if token is available
          if (this.token) {
            this.log('Token available, authenticating...');
            this.authenticate();
          } else {
            this.log('No token available, skipping authentication');
            // Try to get token from localStorage
            const storedToken = localStorage.getItem('token');
            if (storedToken) {
              this.log('Found token in localStorage, authenticating...');
              this.token = storedToken;
              this.authenticate();
            }
          }
          
          // Start heartbeat
          this.startHeartbeat();
          
          // Process queued messages
          this.processQueue();
          
          // Notify state management system
          store.dispatch('websocket:statusChanged', { status: 'connected' });
          
          // Resolve promise
          resolve();
        };
        
        // Listen for messages
        this.socket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            this.log('Error parsing message', error);
          }
        };
        
        // Connection closed
        this.socket.onclose = (event) => {
          this.status = 'disconnected';
          this.log(`Disconnected: ${event.code} ${event.reason}`);
          
          // Stop heartbeat
          this.stopHeartbeat();
          
          // Notify state management system
          store.dispatch('websocket:statusChanged', { status: 'disconnected' });
          
          // Attempt to reconnect
          this.attemptReconnect();
        };
        
        // Connection error
        this.socket.onerror = (error) => {
          this.status = 'error';
          this.log('Connection error', error);
          
          // Notify state management system
          store.dispatch('websocket:statusChanged', { status: 'error', error });
          
          // Reject promise if still pending
          reject(error);
        };
      } catch (error) {
        this.status = 'error';
        this.log('Failed to create WebSocket', error);
        
        // Notify state management system
        store.dispatch('websocket:statusChanged', { status: 'error', error });
        
        // Attempt to reconnect
        this.attemptReconnect();
        
        // Reject promise
        reject(error);
      }
    });
  }
  
  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    if (this.socket) {
      this.log('Disconnecting');
      
      // Stop heartbeat
      this.stopHeartbeat();
      
      // Clear reconnect timer
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      
      // Close socket
      this.socket.close(1000, 'Client disconnected');
      this.socket = null;
      this.status = 'disconnected';
      
      // Notify state management system
      store.dispatch('websocket:statusChanged', { status: 'disconnected' });
    }
  }
  
  /**
   * Attempt to reconnect to WebSocket server
   */
  attemptReconnect() {
    // Don't attempt to reconnect if already reconnecting
    if (this.reconnectTimer) {
      return;
    }
    
    // Check if max reconnect attempts reached
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.log('Max reconnect attempts reached');
      
      // Notify state management system
      store.dispatch('websocket:statusChanged', { 
        status: 'error', 
        error: 'Max reconnect attempts reached' 
      });
      
      return;
    }
    
    // Calculate delay with exponential backoff
    const delay = this.reconnectDelay * Math.pow(this.reconnectBackoffRate, this.reconnectAttempts);
    
    this.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
    
    // Set reconnect timer
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectAttempts++;
      this.connect().catch(() => {
        // Connect failed, will automatically attempt to reconnect
      });
    }, delay);
  }
  
  /**
   * Start heartbeat mechanism
   */
  startHeartbeat() {
    this.stopHeartbeat(); // Clear any existing heartbeat
    
    this.missedHeartbeats = 0;
    
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected()) {
        this.emit('heartbeat', { timestamp: Date.now() });
        this.missedHeartbeats++;
        
        if (this.missedHeartbeats >= this.maxMissedHeartbeats) {
          this.log(`Missed ${this.missedHeartbeats} heartbeats, reconnecting`);
          this.disconnect();
          this.connect();
        }
      } else {
        this.stopHeartbeat();
      }
    }, this.heartbeatInterval);
    
    // Listen for heartbeat responses
    this.on('heartbeat', () => {
      this.missedHeartbeats = 0;
    });
  }
  
  /**
   * Stop heartbeat mechanism
   */
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
  
  /**
   * Authenticate with WebSocket server
   */
  authenticate() {
    if (this.isConnected() && this.token) {
      this.log('Sending authentication request with token');
      
      try {
        // Format the authentication message
        const authMessage = {
          type: 'authenticate',
          token: this.token,
          payload: {}
        };
        
        // Send the authentication message
        this.socket.send(JSON.stringify(authMessage));
        
        this.log('Authentication request sent');
        
        // Set a timeout for authentication response
        if (this.authTimeout) {
          clearTimeout(this.authTimeout);
        }
        
        this.authTimeout = setTimeout(() => {
          if (this.status !== 'authenticated') {
            this.log('Authentication timeout');
            this.status = 'error';
            store.dispatch('websocket:statusChanged', { 
              status: 'error', 
              error: 'Authentication timeout' 
            });
            
            // Try to reconnect
            this.disconnect();
            this.connect();
          }
        }, 5000); // 5 second timeout
      } catch (error) {
        this.log('Error sending authentication request: ' + error.message);
        this.status = 'error';
        store.dispatch('websocket:statusChanged', { 
          status: 'error', 
          error: 'Authentication error: ' + error.message 
        });
      }
    } else {
      if (!this.isConnected()) {
        this.log('Cannot authenticate: Not connected');
      } else if (!this.token) {
        this.log('Cannot authenticate: No token available');
      }
    }
  }
  
  /**
   * Handle incoming message
   * @param {Object} message - Message object
   */
  handleMessage(message) {
    const { type, payload } = message;
    
    this.log(`Received message: ${type}`, payload);
    
    // Handle heartbeat response
    if (type === 'pong') {
      this.missedHeartbeats = 0;
      return;
    }
    
    // Handle welcome message
    if (type === 'welcome') {
      this.log('Connected to WebSocket server');
      return;
    }
    
    // Handle authentication response
    if (type === 'authenticated') {
      this.log('Authentication successful', payload);
      // Update connection status
      this.status = 'authenticated';
      store.dispatch('websocket:statusChanged', { status: 'authenticated' });
      return;
    }
    
    // Handle authentication error
    if (type === 'unauthorized') {
      this.log('Authentication failed', payload);
      this.status = 'error';
      store.dispatch('websocket:statusChanged', { status: 'error', error: payload });
      return;
    }
    
    // Handle transaction events
    if (type === 'transaction:added' || 
        type === 'transaction:updated' || 
        type === 'transaction:deleted') {
      // Dispatch to store
      store.dispatch(type, payload);
    }
    
    // Notify event handlers
    this.notifyHandlers(event, data);
    
    // Dispatch to state management system
    this.dispatchToStore(event, data);
  }
  
  /**
   * Notify event handlers
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  notifyHandlers(event, data) {
    // Notify specific event handlers
    if (this.eventHandlers.has(event)) {
      this.eventHandlers.get(event).forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          this.log(`Error in handler for ${event}`, error);
        }
      });
    }
    
    // Notify persistent handlers
    if (this.persistentHandlers.has(event)) {
      this.persistentHandlers.get(event).forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          this.log(`Error in persistent handler for ${event}`, error);
        }
      });
    }
    
    // Notify wildcard handlers
    if (this.eventHandlers.has('*')) {
      this.eventHandlers.get('*').forEach(handler => {
        try {
          handler({ event, data });
        } catch (error) {
          this.log('Error in wildcard handler', error);
        }
      });
    }
  }
  
  /**
   * Dispatch event to state management system
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  dispatchToStore(event, data) {
    // Map WebSocket events to store actions
    const eventMap = {
      'transaction:added': 'transaction:add',
      'transaction:updated': 'transaction:update',
      'transaction:deleted': 'transaction:delete',
      'savingsGoal:added': 'savingsGoal:add',
      'savingsGoal:updated': 'savingsGoal:update',
      'savingsGoal:deleted': 'savingsGoal:delete',
      'budget:added': 'budget:add',
      'budget:updated': 'budget:update',
      'budget:deleted': 'budget:delete'
    };
    
    // Check if event should be dispatched to store
    if (eventMap[event]) {
      store.dispatch(eventMap[event], data);
    }
  }
  
  /**
   * Register event handler
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   * @returns {Function} Unsubscribe function
   */
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    
    this.eventHandlers.get(event).add(handler);
    
    this.log(`Registered handler for ${event}`);
    
    // Return unsubscribe function
    return () => {
      this.off(event, handler);
    };
  }
  
  /**
   * Register persistent event handler
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   * @returns {Function} Unsubscribe function
   */
  onPersistent(event, handler) {
    if (!this.persistentHandlers.has(event)) {
      this.persistentHandlers.set(event, new Set());
    }
    
    this.persistentHandlers.get(event).add(handler);
    
    this.log(`Registered persistent handler for ${event}`);
    
    // Return unsubscribe function
    return () => {
      this.offPersistent(event, handler);
    };
  }
  
  /**
   * Unregister event handler
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   */
  off(event, handler) {
    if (this.eventHandlers.has(event)) {
      this.eventHandlers.get(event).delete(handler);
      
      // Clean up empty sets
      if (this.eventHandlers.get(event).size === 0) {
        this.eventHandlers.delete(event);
      }
      
      this.log(`Unregistered handler for ${event}`);
    }
  }
  
  /**
   * Unregister persistent event handler
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   */
  offPersistent(event, handler) {
    if (this.persistentHandlers.has(event)) {
      this.persistentHandlers.get(event).delete(handler);
      
      // Clean up empty sets
      if (this.persistentHandlers.get(event).size === 0) {
        this.persistentHandlers.delete(event);
      }
      
      this.log(`Unregistered persistent handler for ${event}`);
    }
  }
  
  /**
   * Emit event to server
   * @param {string} type - Message type
   * @param {*} payload - Message payload
   * @returns {boolean} Whether message was sent successfully
   */
  emit(type, payload) {
    if (!this.isConnected()) {
      this.log(`Cannot emit ${type}: not connected`);
      this.queueMessage({ type, payload });
      return false;
    }
    
    this.log(`Emitting ${type}`);
    
    // Format message according to backend expectations
    const message = {
      type,
      token: this.token,
      payload: payload || {}
    };
    
    try {
      this.socket.send(JSON.stringify(message));
      return true;
    } catch (error) {
      this.log(`Error sending message: ${type}`, error);
      this.queueMessage({ type, payload });
      return false;
    }
  }
  
  /**
   * Queue message for later sending
   * @param {Object} message - Message object
   */
  queueMessage(message) {
    // Add timestamp to message
    message.timestamp = Date.now();
    
    // Add to queue
    this.messageQueue.push(message);
    
    // Limit queue size
    if (this.messageQueue.length > this.maxQueueSize) {
      this.messageQueue.shift();
    }
    
    this.log(`Message queued, queue size: ${this.messageQueue.length}`);
  }
  
  /**
   * Process queued messages
   */
  processQueue() {
    if (!this.isConnected() || this.messageQueue.length === 0) {
      return;
    }
    
    this.log(`Processing message queue, size: ${this.messageQueue.length}`);
    
    // Process queue in order
    const queue = [...this.messageQueue];
    this.messageQueue = [];
    
    queue.forEach(message => {
      try {
        this.socket.send(JSON.stringify(message));
        this.log(`Sent queued message: ${message.event}`);
      } catch (error) {
        this.log(`Error sending queued message: ${message.event}`, error);
        this.queueMessage(message);
      }
    });
  }
  
  /**
   * Clear message queue
   */
  clearQueue() {
    this.messageQueue = [];
    this.log('Message queue cleared');
  }
  
  /**
   * Get connection status
   * @returns {string} Connection status
   */
  getStatus() {
    return this.status;
  }
}

// Create and export singleton instance
export const webSocketService = new WebSocketService();

// For backwards compatibility with non-module scripts
window.webSocketService = webSocketService;

// Export class for testing or custom instances
export default WebSocketService;
