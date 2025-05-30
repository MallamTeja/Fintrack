/**
 * Dashboard Connection Handler Utility
 * 
 * This utility establishes and maintains a WebSocket connection to the backend,
 * providing real-time data updates for the dashboard. It handles reconnection,
 * error states, and data synchronization automatically.
 */

class DashboardConnectionHandler {
  constructor(url, onDataUpdate, onStatusChange) {
    this.url = url || 'ws://localhost:5000/dashboard'; // Default WebSocket URL
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000; // Start with 1 second delay
    this.onDataUpdate = onDataUpdate || (() => {});
    this.onStatusChange = onStatusChange || (() => {});
    this.isConnected = false;
    this.syncInterval = null;
    this.lastSyncTime = null;
  }

  /**
   * Initialize the WebSocket connection
   */
  connect() {
    this.updateStatus('connecting', 'Connecting to dashboard service...');
    
    try {
      this.socket = new WebSocket(this.url);
      
      this.socket.onopen = () => {
        this.handleConnectionOpen();
      };
      
      this.socket.onmessage = (event) => {
        this.handleMessage(event);
      };
      
      this.socket.onerror = (error) => {
        this.handleError(error);
      };
      
      this.socket.onclose = (event) => {
        this.handleConnectionClose(event);
      };
    } catch (error) {
      this.updateStatus('error', `Failed to connect: ${error.message}`);
      this.attemptReconnect();
    }
  }

  /**
   * Handle successful connection opening
   */
  handleConnectionOpen() {
    this.isConnected = true;
    this.reconnectAttempts = 0;
    this.updateStatus('connected', 'Connected to dashboard service');
    this.requestInitialData();
    this.startDataSync();
  }

  /**
   * Handle incoming WebSocket messages
   */
  handleMessage(event) {
    try {
      const data = JSON.parse(event.data);
      this.lastSyncTime = new Date();
      
      if (data.type === 'error') {
        this.updateStatus('warning', `Service warning: ${data.message}`);
      } else {
        this.updateStatus('connected', 'Data synchronized', this.lastSyncTime);
        this.onDataUpdate(data);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      this.updateStatus('warning', 'Received invalid data format');
    }
  }

  /**
   * Handle WebSocket errors
   */
  handleError(error) {
    console.error('WebSocket error:', error);
    this.updateStatus('error', 'Connection error occurred');
  }

  /**
   * Handle connection close events
   */
  handleConnectionClose(event) {
    this.isConnected = false;
    this.stopDataSync();
    
    if (event.wasClean) {
      this.updateStatus('disconnected', `Connection closed: ${event.reason}`);
    } else {
      this.updateStatus('error', 'Connection lost unexpectedly');
      this.attemptReconnect();
    }
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = Math.min(30000, this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts));
      this.reconnectAttempts++;
      
      this.updateStatus('reconnecting', `Reconnecting (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      this.updateStatus('error', 'Failed to connect after multiple attempts. Please reload the page.');
    }
  }

  /**
   * Update connection status and notify listeners
   */
  updateStatus(status, message, timestamp = null) {
    const statusUpdate = {
      status,
      message,
      timestamp: timestamp || new Date()
    };
    
    this.onStatusChange(statusUpdate);
  }

  /**
   * Request initial dashboard data
   */
  requestInitialData() {
    if (this.isConnected) {
      this.socket.send(JSON.stringify({ type: 'initial_data_request' }));
    }
  }

  /**
   * Start the regular data synchronization interval
   */
  startDataSync() {
    // Clear any existing interval first
    this.stopDataSync();
    
    // Set up a new interval to request updates every second
    this.syncInterval = setInterval(() => {
      if (this.isConnected) {
        this.socket.send(JSON.stringify({ 
          type: 'sync_request',
          timestamp: new Date().toISOString()
        }));
      }
    }, 1000); // Update every second
  }

  /**
   * Stop the data synchronization interval
   */
  stopDataSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Manually request a data refresh
   */
  refreshData() {
    if (this.isConnected) {
      this.socket.send(JSON.stringify({ 
        type: 'force_refresh',
        timestamp: new Date().toISOString()
      }));
      this.updateStatus('refreshing', 'Manually refreshing data...');
    } else {
      this.updateStatus('error', 'Cannot refresh: not connected');
      this.connect(); // Try to connect if not already connected
    }
  }

  /**
   * Manually close the connection
   */
  disconnect() {
    this.stopDataSync();
    
    if (this.socket) {
      this.socket.close(1000, 'User initiated disconnect');
      this.socket = null;
    }
    
    this.isConnected = false;
    this.updateStatus('disconnected', 'Disconnected from service');
  }
}

export default DashboardConnectionHandler;