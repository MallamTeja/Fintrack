/**
 * Connection Status Component - Shows WebSocket connection status
 * 
 * This component:
 * 1. Displays the current WebSocket connection status
 * 2. Provides a button to manually reconnect
 * 3. Updates in real-time when connection status changes
 */

import { store, webSocketService } from '../state/index.js';
import { wsStoreSync } from '../services/wsStoreSync.js';

class ConnectionStatusComponent {
  constructor(containerId) {
    // Get container element
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error(`Container with ID "${containerId}" not found`);
      return;
    }
    
    // Create UI elements
    this.createUI();
    
    // Initialize state
    this.state = {
      status: webSocketService.getStatus(),
      isOffline: false
    };
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Initial render
    this.render();
  }
  
  /**
   * Create UI elements
   */
  createUI() {
    this.container.innerHTML = `
      <div class="connection-status flex items-center space-x-2 text-sm">
        <div class="flex items-center">
          <span class="status-indicator w-2 h-2 rounded-full mr-1"></span>
          <span class="status-text"></span>
        </div>
        <button class="reconnect-btn px-2 py-1 bg-blue-500 text-white rounded text-xs hidden hover:bg-blue-600">
          Reconnect
        </button>
        <button class="resync-btn px-2 py-1 bg-green-500 text-white rounded text-xs hidden hover:bg-green-600">
          Resync Data
        </button>
      </div>
    `;
    
    // Store references to UI elements
    this.elements = {
      statusIndicator: this.container.querySelector('.status-indicator'),
      statusText: this.container.querySelector('.status-text'),
      reconnectBtn: this.container.querySelector('.reconnect-btn'),
      resyncBtn: this.container.querySelector('.resync-btn')
    };
  }
  
  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // WebSocket status changes
    this.unsubscribeStatus = store.subscribe('websocket:statusChanged', (data) => {
      this.state.status = data.status;
      this.render();
    });
    
    // App offline status changes
    this.unsubscribeOffline = store.subscribe('app:offlineChanged', (data) => {
      this.state.isOffline = data.offline;
      this.render();
    });
    
    // Reconnect button
    this.elements.reconnectBtn.addEventListener('click', () => {
      webSocketService.connect()
        .then(() => console.log('WebSocket reconnected'))
        .catch(error => console.error('WebSocket reconnection failed:', error));
    });
    
    // Resync button
    this.elements.resyncBtn.addEventListener('click', () => {
      wsStoreSync.resync();
    });
  }
  
  /**
   * Render component
   */
  render() {
    // Update status indicator color
    const statusColors = {
      connected: 'bg-green-500',
      connecting: 'bg-yellow-500',
      disconnected: 'bg-red-500',
      error: 'bg-red-700'
    };
    
    this.elements.statusIndicator.className = `status-indicator w-2 h-2 rounded-full mr-1 ${statusColors[this.state.status] || 'bg-gray-500'}`;
    
    // Update status text
    let statusText = this.state.status;
    if (this.state.isOffline) {
      statusText = 'offline';
    }
    
    this.elements.statusText.textContent = statusText;
    
    // Show/hide reconnect button
    this.elements.reconnectBtn.classList.toggle('hidden', 
      this.state.status === 'connected' || this.state.status === 'connecting');
    
    // Show/hide resync button
    this.elements.resyncBtn.classList.toggle('hidden', 
      this.state.status !== 'connected');
  }
  
  /**
   * Clean up component
   */
  destroy() {
    // Unsubscribe from store events
    this.unsubscribeStatus && this.unsubscribeStatus();
    this.unsubscribeOffline && this.unsubscribeOffline();
    
    // Remove event listeners
    this.elements.reconnectBtn.removeEventListener('click');
    this.elements.resyncBtn.removeEventListener('click');
  }
}

// Export component
export default ConnectionStatusComponent;

// For backwards compatibility with non-module scripts
window.ConnectionStatusComponent = ConnectionStatusComponent;
