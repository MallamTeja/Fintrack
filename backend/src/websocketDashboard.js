/**
 * WebSocket Dashboard Handler
 * 
 * This module handles WebSocket connections for the dashboard, providing
 * real-time data updates and handling client connection requests.
 */

const WebSocket = require('ws');
const { getLatestDashboardData } = require('./models/dashboard'); // Adjust to your actual data source

class WebSocketDashboardHandler {
  constructor(server) {
    this.wss = new WebSocket.Server({ server });
    this.clients = new Set();
    this.setupEventHandlers();
    this.startGlobalUpdates();
  }

  /**
   * Set up WebSocket server event handlers
   */
  setupEventHandlers() {
    this.wss.on('connection', (ws) => {
      console.log('New dashboard client connected');
      this.clients.add(ws);
      
      // Set up client event handlers
      ws.on('message', (message) => {
        this.handleClientMessage(ws, message);
      });
      
      ws.on('close', () => {
        console.log('Dashboard client disconnected');
        this.clients.delete(ws);
      });
      
      // Send initial connection confirmation
      ws.send(JSON.stringify({
        type: 'connection_established',
        message: 'Connected to dashboard service',
        timestamp: new Date().toISOString()
      }));
    });
  }

  /**
   * Handle client messages
   */
  async handleClientMessage(ws, message) {
    try {
      const parsedMessage = JSON.parse(message);
      
      switch (parsedMessage.type) {
        case 'initial_data_request':
          await this.sendInitialData(ws);
          break;
          
        case 'sync_request':
          await this.sendLatestData(ws);
          break;
          
        case 'force_refresh':
          await this.sendLatestData(ws, true);
          break;
          
        default:
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Unknown request type',
            timestamp: new Date().toISOString()
          }));
      }
    } catch (error) {
      console.error('Error handling client message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Error processing your request',
        timestamp: new Date().toISOString()
      }));
    }
  }

  /**
   * Send initial dashboard data to a client
   */
  async sendInitialData(ws) {
    try {
      const dashboardData = await getLatestDashboardData();
      
      ws.send(JSON.stringify({
        type: 'initial_data',
        data: dashboardData,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error('Error sending initial data:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Unable to retrieve initial dashboard data',
        timestamp: new Date().toISOString()
      }));
    }
  }

  /**
   * Send latest data to a specific client
   */
  async sendLatestData(ws, forceRefresh = false) {
    try {
      const dashboardData = await getLatestDashboardData(forceRefresh);
      
      ws.send(JSON.stringify({
        type: 'data_update',
        data: dashboardData,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error('Error sending data update:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Unable to retrieve updated dashboard data',
        timestamp: new Date().toISOString()
      }));
    }
  }

  /**
   * Broadcast data to all connected clients
   */
  broadcastData(data) {
    const message = JSON.stringify({
      type: 'data_update',
      data,
      timestamp: new Date().toISOString()
    });
    
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  /**
   * Start the global update interval for all clients
   */
  startGlobalUpdates() {
    // Update all clients every 1 second with latest data
    setInterval(async () => {
      if (this.clients.size > 0) {
        try {
          const dashboardData = await getLatestDashboardData();
          this.broadcastData(dashboardData);
        } catch (error) {
          console.error('Error during global update:', error);
        }
      }
    }, 1000);
  }
}

module.exports = WebSocketDashboardHandler;