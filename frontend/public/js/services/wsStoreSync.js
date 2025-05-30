/**
 * WebSocket-Store Synchronization Service
 * 
 * This service handles the synchronization between WebSocket events and the store.
 * It subscribes to WebSocket events and dispatches the corresponding actions to the store.
 * It also provides methods for handling offline/online transitions and conflict resolution.
 */

import { webSocketService } from './webSocketService.js';
import { store } from '../state/index.js';
import { ApiService } from '../state/apiService.js';

// Create an instance of ApiService
const apiService = new ApiService();

class WSStoreSyncService {
  constructor() {
    // Singleton pattern
    if (WSStoreSyncService.instance) {
      return WSStoreSyncService.instance;
    }
    
    WSStoreSyncService.instance = this;
    
    // Event mapping from WebSocket events to store actions
    this.eventMap = {
      // Transaction events
      'transaction:added': 'transaction:add',
      'transaction:updated': 'transaction:update',
      'transaction:deleted': 'transaction:delete',
      
      // Budget events
      'budget:added': 'budget:add',
      'budget:updated': 'budget:update',
      'budget:deleted': 'budget:delete',
      
      // Savings goal events
      'savingsGoal:added': 'savingsGoal:add',
      'savingsGoal:updated': 'savingsGoal:update',
      'savingsGoal:deleted': 'savingsGoal:delete'
    };
    
    // Conflict resolution strategies
    this.conflictStrategies = {
      'transaction': this.resolveTransactionConflict.bind(this),
      'budget': this.resolveBudgetConflict.bind(this),
      'savingsGoal': this.resolveSavingsGoalConflict.bind(this)
    };
    
    // Last sync timestamps
    this.lastSyncTimestamps = {
      'transaction': Date.now(),
      'budget': Date.now(),
      'savingsGoal': Date.now()
    };
    
    // Initialize
    this.initialize();
  }
  
  /**
   * Initialize the service
   */
  initialize() {
    console.log('Initializing WebSocket-Store Sync Service');
    
    // Register WebSocket event handlers
    this.registerEventHandlers();
    
    // Listen for online/offline events
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
    
    // Subscribe to WebSocket connection status changes
    store.subscribe('websocket:statusChanged', this.handleConnectionStatusChange.bind(this));
  }
  
  /**
   * Register WebSocket event handlers
   */
  registerEventHandlers() {
    // Register handlers for all mapped events
    Object.keys(this.eventMap).forEach(event => {
      webSocketService.onPersistent(event, data => {
        this.handleWebSocketEvent(event, data);
      });
    });
    
    // Register handler for connection established event
    webSocketService.onPersistent('connected', () => {
      this.syncWithServer();
    });
  }
  
  /**
   * Handle WebSocket event
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  handleWebSocketEvent(event, data) {
    console.log(`WebSocket event received: ${event}`, data);
    
    // Get corresponding store action
    const action = this.eventMap[event];
    
    if (action) {
      // If transaction added via WebSocket, update state without API call
      if (event === 'transaction:added') {
        const currentTransactions = store.getState('transactions') || [];
        const newTransactions = [data, ...currentTransactions];
        // Update store state directly
        store.state.transactions = newTransactions;
        store.notify('transactions:updated', newTransactions);
        store.notify('transaction:added', data);
        this.lastSyncTimestamps['transaction'] = Date.now();
        return;
      }
      
      const entityType = this.getEntityTypeFromEvent(event);
      
      if (entityType && this.hasLocalChanges(entityType, data)) {
        // Handle conflict
        this.handleConflict(entityType, data);
      } else {
        // No conflict, dispatch to store
        store.dispatch(action, data);
        
        // Update last sync timestamp
        if (entityType) {
          this.lastSyncTimestamps[entityType] = Date.now();
        }
      }
    }
  }
  
  /**
   * Get entity type from event name
   * @param {string} event - Event name
   * @returns {string|null} Entity type or null if not found
   */
  getEntityTypeFromEvent(event) {
    const parts = event.split(':');
    
    if (parts.length >= 2) {
      return parts[0];
    }
    
    return null;
  }
  
  /**
   * Check if there are local changes for the entity
   * @param {string} entityType - Entity type
   * @param {*} serverData - Server data
   * @returns {boolean} Whether there are local changes
   */
  hasLocalChanges(entityType, serverData) {
    // Get local data from store
    const localData = this.getLocalData(entityType, serverData._id);
    
    // If no local data, no conflict
    if (!localData) {
      return false;
    }
    
    // Check if local data has been modified since last sync
    return localData.updatedAt > this.lastSyncTimestamps[entityType];
  }
  
  /**
   * Get local data from store
   * @param {string} entityType - Entity type
   * @param {string} id - Entity ID
   * @returns {*} Local data or null if not found
   */
  getLocalData(entityType, id) {
    switch (entityType) {
      case 'transaction':
        return store.getState().transactions.find(t => t._id === id);
      case 'budget':
        return store.getState().budgets.find(b => b._id === id);
      case 'savingsGoal':
        const savingsGoals = store.getState().savingsGoals;
        return savingsGoals && Array.isArray(savingsGoals) ? savingsGoals.find(g => g._id === id) : null;
      default:
        return null;
    }
  }
  
  /**
   * Handle conflict between local and server data
   * @param {string} entityType - Entity type
   * @param {*} serverData - Server data
   */
  handleConflict(entityType, serverData) {
    console.log(`Conflict detected for ${entityType}`, serverData);
    
    // Get conflict resolution strategy
    const resolveStrategy = this.conflictStrategies[entityType];
    
    if (resolveStrategy) {
      resolveStrategy(serverData);
    } else {
      // Default strategy: server wins
      const action = this.eventMap[`${entityType}:updated`];
      if (action) {
        store.dispatch(action, serverData);
      }
    }
  }
  
  /**
   * Resolve transaction conflict
   * @param {*} serverData - Server data
   */
  resolveTransactionConflict(serverData) {
    // For transactions, we'll use a "server wins" strategy
    // This is because transactions are critical financial data
    store.dispatch('transaction:update', serverData);
    
    // Update last sync timestamp
    this.lastSyncTimestamps.transaction = Date.now();
  }
  
  /**
   * Resolve budget conflict
   * @param {*} serverData - Server data
   */
  resolveBudgetConflict(serverData) {
    // For budgets, we'll use a "server wins" strategy
    store.dispatch('budget:update', serverData);
    
    // Update last sync timestamp
    this.lastSyncTimestamps.budget = Date.now();
  }
  
  /**
   * Resolve savings goal conflict
   * @param {*} serverData - Server data
   */
  resolveSavingsGoalConflict(serverData) {
    // For savings goals, we'll use a "server wins" strategy
    store.dispatch('savingsGoal:update', serverData);
    
    // Update last sync timestamp
    this.lastSyncTimestamps.savingsGoal = Date.now();
  }
  
  /**
   * Handle online event
   */
  handleOnline() {
    console.log('Device is online, reconnecting WebSocket');
    
    // Reconnect WebSocket
    webSocketService.connect();
  }
  
  /**
   * Handle offline event
   */
  handleOffline() {
    console.log('Device is offline, WebSocket disconnected');
    
    // No need to disconnect WebSocket, it will automatically disconnect
    // Just update the UI to show offline status
    store.dispatch('app:setOffline', true);
  }
  
  /**
   * Handle WebSocket connection status change
   * @param {*} data - Connection status data
   */
  handleConnectionStatusChange(data) {
    console.log('WebSocket connection status changed:', data);
    
    if (data.status === 'connected') {
      // WebSocket connected, sync with server
      this.syncWithServer();
      
      // Update UI to show online status
      store.dispatch('app:setOffline', false);
    } else if (data.status === 'disconnected' || data.status === 'error') {
      // WebSocket disconnected, update UI to show offline status
      store.dispatch('app:setOffline', true);
    }
  }
  
  /**
   * Sync with server
   * This is called when the WebSocket connection is established
   * or when the device comes back online
   */
  syncWithServer() {
    console.log('Syncing with server');
    
    // Fetch latest data from server
    this.fetchTransactions();
    this.fetchBudgets();
    this.fetchSavingsGoals();
  }
  
  /**
   * Fetch transactions from server
   */
  async fetchTransactions() {
    try {
      const transactions = await apiService.get('/transactions');
      store.dispatch('transaction:setAll', transactions);
      
      // Update last sync timestamp
      this.lastSyncTimestamps.transaction = Date.now();
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  }
  
  /**
   * Fetch budgets from server
   */
  async fetchBudgets() {
    try {
      const budgets = await apiService.get('/budgets');
      store.dispatch('budget:setAll', budgets);
      
      // Update last sync timestamp
      this.lastSyncTimestamps.budget = Date.now();
    } catch (error) {
      console.error('Error fetching budgets:', error);
    }
  }
  
  /**
   * Fetch savings goals from server
   */
  async fetchSavingsGoals() {
    try {
      const savingsGoals = await apiService.get('/savings-goals');
      store.dispatch('savingsGoal:setAll', savingsGoals);
      
      // Update last sync timestamp
      this.lastSyncTimestamps.savingsGoal = Date.now();
    } catch (error) {
      console.error('Error fetching savings goals:', error);
    }
  }
  
  /**
   * Force resync with server
   * This can be called manually when needed
   */
  resync() {
    console.log('Forcing resync with server');
    
    // Fetch latest data from server
    this.syncWithServer();
  }
}

// Create and export singleton instance
export const wsStoreSync = new WSStoreSyncService();

// For backwards compatibility with non-module scripts
window.wsStoreSync = wsStoreSync;
