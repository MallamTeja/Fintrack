/**
 * WebSocket Demo Component - Demonstrates how to use the WebSocket service
 * 
 * This component shows:
 * 1. How to connect to the WebSocket server
 * 2. How to register event handlers
 * 3. How to send events
 * 4. How to handle connection status changes
 */

import { webSocketService } from '../services/webSocketService.js';
import { store } from '../state/index.js';

class WebSocketDemoComponent {
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
      connectionStatus: webSocketService.getStatus(),
      messages: []
    };
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Initial render
    this.render();
    
    // Connect to WebSocket server
    this.connect();
  }
  
  /**
   * Create UI elements
   */
  createUI() {
    this.container.innerHTML = `
      <div class="websocket-demo p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <h2 class="text-2xl font-bold mb-4">WebSocket Demo</h2>
        
        <div class="mb-6">
          <div class="flex items-center mb-2">
            <span class="font-semibold mr-2">Status:</span>
            <span id="connection-status" class="px-2 py-1 rounded text-white">Disconnected</span>
          </div>
          
          <div class="flex space-x-2">
            <button id="connect-btn" class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">Connect</button>
            <button id="disconnect-btn" class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">Disconnect</button>
          </div>
        </div>
        
        <div class="mb-6">
          <h3 class="text-xl font-semibold mb-2">Send Message</h3>
          
          <div class="flex flex-col space-y-2 mb-2">
            <select id="event-type" class="px-3 py-2 border rounded dark:bg-gray-700 dark:text-white">
              <option value="transaction:add">transaction:add</option>
              <option value="transaction:update">transaction:update</option>
              <option value="transaction:delete">transaction:delete</option>
              <option value="savingsGoal:add">savingsGoal:add</option>
              <option value="savingsGoal:update">savingsGoal:update</option>
              <option value="savingsGoal:delete">savingsGoal:delete</option>
              <option value="budget:add">budget:add</option>
              <option value="budget:update">budget:update</option>
              <option value="budget:delete">budget:delete</option>
              <option value="custom">custom event</option>
            </select>
            
            <input id="custom-event" class="px-3 py-2 border rounded dark:bg-gray-700 dark:text-white hidden" placeholder="Custom event name">
            
            <textarea id="message-data" class="px-3 py-2 border rounded dark:bg-gray-700 dark:text-white" rows="4" placeholder='{"key": "value"}'></textarea>
          </div>
          
          <button id="send-btn" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">Send</button>
        </div>
        
        <div>
          <h3 class="text-xl font-semibold mb-2">Messages</h3>
          <div id="messages" class="border rounded p-4 h-64 overflow-y-auto dark:bg-gray-700 dark:text-white">
            <div class="text-gray-500 dark:text-gray-400 italic">No messages yet</div>
          </div>
        </div>
      </div>
    `;
    
    // Store references to UI elements
    this.elements = {
      connectionStatus: this.container.querySelector('#connection-status'),
      connectBtn: this.container.querySelector('#connect-btn'),
      disconnectBtn: this.container.querySelector('#disconnect-btn'),
      eventType: this.container.querySelector('#event-type'),
      customEvent: this.container.querySelector('#custom-event'),
      messageData: this.container.querySelector('#message-data'),
      sendBtn: this.container.querySelector('#send-btn'),
      messages: this.container.querySelector('#messages')
    };
  }
  
  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Connect button
    this.elements.connectBtn.addEventListener('click', () => {
      this.connect();
    });
    
    // Disconnect button
    this.elements.disconnectBtn.addEventListener('click', () => {
      webSocketService.disconnect();
    });
    
    // Event type select
    this.elements.eventType.addEventListener('change', () => {
      const isCustom = this.elements.eventType.value === 'custom';
      this.elements.customEvent.classList.toggle('hidden', !isCustom);
    });
    
    // Send button
    this.elements.sendBtn.addEventListener('click', () => {
      this.sendMessage();
    });
    
    // WebSocket status changes
    this.unsubscribeStatus = store.subscribe('websocket:statusChanged', (data) => {
      this.state.connectionStatus = data.status;
      this.render();
    });
    
    // WebSocket message handlers
    this.setupMessageHandlers();
  }
  
  /**
   * Set up WebSocket message handlers
   */
  setupMessageHandlers() {
    // Transaction events
    this.unsubscribeTransactionAdded = webSocketService.on('transaction:added', (data) => {
      this.addMessage('transaction:added', data);
    });
    
    this.unsubscribeTransactionUpdated = webSocketService.on('transaction:updated', (data) => {
      this.addMessage('transaction:updated', data);
    });
    
    this.unsubscribeTransactionDeleted = webSocketService.on('transaction:deleted', (data) => {
      this.addMessage('transaction:deleted', data);
    });
    
    // Savings goal events
    this.unsubscribeSavingsGoalAdded = webSocketService.on('savingsGoal:added', (data) => {
      this.addMessage('savingsGoal:added', data);
    });
    
    this.unsubscribeSavingsGoalUpdated = webSocketService.on('savingsGoal:updated', (data) => {
      this.addMessage('savingsGoal:updated', data);
    });
    
    this.unsubscribeSavingsGoalDeleted = webSocketService.on('savingsGoal:deleted', (data) => {
      this.addMessage('savingsGoal:deleted', data);
    });
    
    // Budget events
    this.unsubscribeBudgetAdded = webSocketService.on('budget:added', (data) => {
      this.addMessage('budget:added', data);
    });
    
    this.unsubscribeBudgetUpdated = webSocketService.on('budget:updated', (data) => {
      this.addMessage('budget:updated', data);
    });
    
    this.unsubscribeBudgetDeleted = webSocketService.on('budget:deleted', (data) => {
      this.addMessage('budget:deleted', data);
    });
    
    // Wildcard handler for all events
    this.unsubscribeWildcard = webSocketService.on('*', (data) => {
      this.addMessage(data.event, data.data);
    });
  }
  
  /**
   * Connect to WebSocket server
   */
  connect() {
    webSocketService.connect()
      .then(() => {
        console.log('Connected to WebSocket server');
      })
      .catch((error) => {
        console.error('Failed to connect to WebSocket server', error);
      });
  }
  
  /**
   * Send message to WebSocket server
   */
  sendMessage() {
    // Get event type
    let eventType = this.elements.eventType.value;
    if (eventType === 'custom') {
      eventType = this.elements.customEvent.value;
      if (!eventType) {
        alert('Please enter a custom event name');
        return;
      }
    }
    
    // Get message data
    let data;
    try {
      data = JSON.parse(this.elements.messageData.value || '{}');
    } catch (error) {
      alert('Invalid JSON data');
      return;
    }
    
    // Send message
    webSocketService.emit(eventType, data);
    
    // Add to messages
    this.addMessage(eventType, data, true);
    
    // Clear message data
    this.elements.messageData.value = '';
  }
  
  /**
   * Add message to messages list
   * @param {string} event - Event name
   * @param {*} data - Event data
   * @param {boolean} sent - Whether message was sent or received
   */
  addMessage(event, data, sent = false) {
    // Add message to state
    this.state.messages.unshift({
      id: Date.now(),
      event,
      data,
      sent,
      timestamp: new Date().toISOString()
    });
    
    // Limit messages
    if (this.state.messages.length > 50) {
      this.state.messages.pop();
    }
    
    // Update UI
    this.renderMessages();
  }
  
  /**
   * Render component
   */
  render() {
    // Update connection status
    const statusColors = {
      connected: 'bg-green-500',
      connecting: 'bg-yellow-500',
      disconnected: 'bg-red-500',
      error: 'bg-red-700'
    };
    
    this.elements.connectionStatus.textContent = this.state.connectionStatus;
    this.elements.connectionStatus.className = `px-2 py-1 rounded text-white ${statusColors[this.state.connectionStatus] || 'bg-gray-500'}`;
    
    // Update buttons
    this.elements.connectBtn.disabled = this.state.connectionStatus === 'connected' || this.state.connectionStatus === 'connecting';
    this.elements.disconnectBtn.disabled = this.state.connectionStatus === 'disconnected';
    
    // Render messages
    this.renderMessages();
  }
  
  /**
   * Render messages
   */
  renderMessages() {
    if (this.state.messages.length === 0) {
      this.elements.messages.innerHTML = '<div class="text-gray-500 dark:text-gray-400 italic">No messages yet</div>';
      return;
    }
    
    this.elements.messages.innerHTML = this.state.messages.map(message => `
      <div class="mb-2 p-2 border-b border-gray-200 dark:border-gray-600">
        <div class="flex justify-between items-center mb-1">
          <span class="font-semibold">${message.event}</span>
          <span class="text-xs text-gray-500 dark:text-gray-400">
            ${message.sent ? 'Sent' : 'Received'} at ${new Date(message.timestamp).toLocaleTimeString()}
          </span>
        </div>
        <pre class="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto">${JSON.stringify(message.data, null, 2)}</pre>
      </div>
    `).join('');
  }
  
  /**
   * Clean up component
   */
  destroy() {
    // Unsubscribe from WebSocket events
    this.unsubscribeTransactionAdded && this.unsubscribeTransactionAdded();
    this.unsubscribeTransactionUpdated && this.unsubscribeTransactionUpdated();
    this.unsubscribeTransactionDeleted && this.unsubscribeTransactionDeleted();
    this.unsubscribeSavingsGoalAdded && this.unsubscribeSavingsGoalAdded();
    this.unsubscribeSavingsGoalUpdated && this.unsubscribeSavingsGoalUpdated();
    this.unsubscribeSavingsGoalDeleted && this.unsubscribeSavingsGoalDeleted();
    this.unsubscribeBudgetAdded && this.unsubscribeBudgetAdded();
    this.unsubscribeBudgetUpdated && this.unsubscribeBudgetUpdated();
    this.unsubscribeBudgetDeleted && this.unsubscribeBudgetDeleted();
    this.unsubscribeWildcard && this.unsubscribeWildcard();
    
    // Unsubscribe from store events
    this.unsubscribeStatus && this.unsubscribeStatus();
    
    // Remove event listeners
    this.elements.connectBtn.removeEventListener('click');
    this.elements.disconnectBtn.removeEventListener('click');
    this.elements.eventType.removeEventListener('change');
    this.elements.sendBtn.removeEventListener('click');
  }
}

// Export component
export default WebSocketDemoComponent;

// For backwards compatibility with non-module scripts
window.WebSocketDemoComponent = WebSocketDemoComponent;
