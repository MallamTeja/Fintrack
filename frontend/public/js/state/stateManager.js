rd/**
 * StateManager - Centralized state management for FinTrack application
 * 
 * This module provides a centralized state store with:
 * - Global singleton store pattern
 * - Event subscription system
 * - CRUD operations for all data types
 * - Controlled update triggers via dispatch
 * - Persistence via localStorage and API
 */

// Import API services (these would be created separately)
import { ApiService } from './apiService.js';
import { StorageService } from './storageService.js';

class StateManager {
  constructor() {
    // Singleton pattern
    if (StateManager.instance) {
      return StateManager.instance;
    }
    
    StateManager.instance = this;
    
    // Initialize services
    this.api = new ApiService();
    this.storage = new StorageService();
    
    // Initialize state
    this.state = {
      transactions: [],
      savingsGoals: [],
      budgets: [],
      categories: [],
      user: null,
      ui: {
        theme: 'dark',
        loading: {
          transactions: false,
          savingsGoals: false,
          budgets: false
        },
        errors: {}
      }
    };
    
    // Event subscribers
    this.subscribers = new Map();
    
    // Initialize with data from localStorage
    this.hydrateFromStorage();
    
    // Fetch initial data from API
    this.fetchInitialData();
  }
  
  /**
   * Subscribe to state changes
   * @param {string} eventType - Type of event to subscribe to (e.g., 'transactions:updated')
   * @param {Function} callback - Callback function to execute when event occurs
   * @returns {Function} Unsubscribe function
   */
  subscribe(eventType, callback) {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }
    
    this.subscribers.get(eventType).add(callback);
    
    // Return unsubscribe function
    return () => {
      const subscribers = this.subscribers.get(eventType);
      if (subscribers) {
        subscribers.delete(callback);
      }
    };
  }
  
  /**
   * Dispatch an event to trigger state changes
   * @param {string} actionType - Type of action (e.g., 'transaction:add')
   * @param {*} payload - Data associated with the action
   */
    async dispatch(actionType, payload) {
    console.log(`Dispatching action: ${actionType}`, payload);
    
    try {
      // Handle different action types
      switch (actionType) {
        // Transaction actions
        case 'transactions:fetch':
          await this.fetchTransactions();
          break;
        case 'transaction:add':
          await this.addTransaction(payload);
          break;
        case 'transaction:update':
          await this.updateTransaction(payload.id, payload.data);
          break;
        case 'transaction:delete':
          await this.deleteTransaction(payload);
          break;
          
        // Savings goal actions
        case 'savingsGoals:fetch':
          await this.fetchSavingsGoals();
          break;
        case 'savingsGoal:add':
          await this.addSavingsGoal(payload);
          break;
        case 'savingsGoal:update':
          await this.updateSavingsGoal(payload.id, payload.data);
          break;
        case 'savingsGoal:delete':
          await this.deleteSavingsGoal(payload);
          break;
        case 'savingsGoal:setAll':
          this.state.savingsGoals = payload;
          this.persistToStorage();
          this.notify('savingsGoals:updated', payload);
          break;
          
        // Budget actions
        case 'budgets:fetch':
          await this.fetchBudgets();
          break;
        case 'budget:add':
          await this.addBudget(payload);
          break;
        case 'budget:update':
          await this.updateBudget(payload.id, payload.data);
          break;
        case 'budget:delete':
          await this.deleteBudget(payload);
          break;
          
        // UI actions
        case 'ui:setTheme':
          this.setTheme(payload);
          break;
        case 'ui:setLoading':
          this.setLoading(payload.entity, payload.isLoading);
          break;
        case 'ui:setError':
          this.setError(payload.entity, payload.error);
          break;
          
        // User actions
        case 'user:login':
          await this.loginUser(payload);
          break;
        case 'user:logout':
          this.logoutUser();
          break;
        case 'user:update':
          await this.updateUser(payload);
          break;
          
        default:
          console.warn(`Unknown action type: ${actionType}`);
      }
    } catch (error) {
      console.error(`Error handling action ${actionType}:`, error);
      this.setError(actionType.split(':')[0], error.message);
    }
  }
  
  /**
   * Notify subscribers of state changes
   * @param {string} eventType - Type of event that occurred
   * @param {*} data - Data associated with the event
   */
  notify(eventType, data) {
    console.log(`Notifying subscribers: ${eventType}`);
    
    // Notify specific event subscribers
    if (this.subscribers.has(eventType)) {
      this.subscribers.get(eventType).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in subscriber callback for ${eventType}:`, error);
        }
      });
    }
    
    // Notify wildcard subscribers
    if (this.subscribers.has('*')) {
      this.subscribers.get('*').forEach(callback => {
        try {
          callback({ type: eventType, data });
        } catch (error) {
          console.error(`Error in wildcard subscriber callback for ${eventType}:`, error);
        }
      });
    }
  }
  
  /**
   * Get current state or a slice of state
   * @param {string} [path] - Optional path to get a specific slice of state
   * @returns {*} Current state or slice of state
   */
  getState(path) {
    if (!path) {
      return { ...this.state }; // Return a copy to prevent direct mutation
    }
    
    // Handle dot notation for nested properties
    const parts = path.split('.');
    let result = this.state;
    
    for (const part of parts) {
      if (result === undefined || result === null) {
        return undefined;
      }
      result = result[part];
    }
    
    // Return a copy for objects and arrays
    if (typeof result === 'object' && result !== null) {
      return Array.isArray(result) ? [...result] : { ...result };
    }
    
    return result;
  }
  
  /**
   * Hydrate state from localStorage
   */
  hydrateFromStorage() {
    try {
      // Load transactions
      const transactions = this.storage.get('transactions');
      if (transactions) {
        this.state.transactions = transactions;
      }
      
      // Load savings goals
      const savingsGoals = this.storage.get('savingsGoals');
      if (savingsGoals) {
        this.state.savingsGoals = savingsGoals;
      }
      
      // Load budgets
      const budgets = this.storage.get('budgets');
      if (budgets) {
        this.state.budgets = budgets;
      }
      
      // Load user
      const user = this.storage.get('user');
      if (user) {
        this.state.user = user;
      }
      
      // Load UI preferences
      const theme = this.storage.get('theme');
      if (theme) {
        this.state.ui.theme = theme;
      }
      
      console.log('State hydrated from localStorage');
    } catch (error) {
      console.error('Error hydrating state from localStorage:', error);
    }
  }
  
  /**
   * Persist state to localStorage
   */
  persistToStorage() {
    try {
      this.storage.set('transactions', this.state.transactions);
      this.storage.set('savingsGoals', this.state.savingsGoals);
      this.storage.set('budgets', this.state.budgets);
      this.storage.set('user', this.state.user);
      this.storage.set('theme', this.state.ui.theme);
      
      console.log('State persisted to localStorage');
    } catch (error) {
      console.error('Error persisting state to localStorage:', error);
    }
  }
  
  /**
   * Fetch initial data from API
   */
  async fetchInitialData() {
    try {
      // Only fetch if user is logged in
      if (this.state.user && this.state.user.token) {
        await Promise.all([
          this.fetchTransactions(),
          this.fetchSavingsGoals(),
          this.fetchBudgets()
        ]);
      }
    } catch (error) {
      console.error('Error fetching initial data:', error);
    }
  }
  
  // ==============================
  // Transaction Methods
  // ==============================
  
  /**
   * Fetch transactions from API
   */
  async fetchTransactions() {
    this.setLoading('transactions', true);
    
    try {
      const transactions = await this.api.get('/transactions');
      this.state.transactions = transactions;
      this.persistToStorage();
      this.notify('transactions:updated', transactions);
      return transactions;
    } catch (error) {
      console.error('Error fetching transactions:', error);
      this.setError('transactions', 'Failed to fetch transactions');
      throw error;
    } finally {
      this.setLoading('transactions', false);
    }
  }
  
  /**
   * Add a new transaction
   * @param {Object} transaction - Transaction to add
   */
  async addTransaction(transaction) {
    this.setLoading('transactions', true);
    
    try {
      // Add timestamp if not provided
      if (!transaction.date) {
        transaction.date = new Date().toISOString();
      }
      
      // Add to API
      const newTransaction = await this.api.post('/transactions', transaction);
      
      // Update local state
      this.state.transactions = [newTransaction, ...this.state.transactions];
      this.persistToStorage();
      
      // Notify subscribers
      this.notify('transactions:updated', this.state.transactions);
      this.notify('transaction:added', newTransaction);
      
      return newTransaction;
    } catch (error) {
      console.error('Error adding transaction:', error);
      this.setError('transactions', 'Failed to add transaction');
      
      // Fallback: Add to local state even if API fails
      const fallbackTransaction = {
        id: Date.now().toString(),
        ...transaction,
        _offline: true
      };
      
      this.state.transactions = [fallbackTransaction, ...this.state.transactions];
      this.persistToStorage();
      
      this.notify('transactions:updated', this.state.transactions);
      this.notify('transaction:added', fallbackTransaction);
      
      return fallbackTransaction;
    } finally {
      this.setLoading('transactions', false);
    }
  }
  
  /**
   * Update an existing transaction
   * @param {string} id - ID of transaction to update
   * @param {Object} data - Updated transaction data
   */
  async updateTransaction(id, data) {
    this.setLoading('transactions', true);
    
    try {
      // Update in API
      const updatedTransaction = await this.api.patch(`/transactions/${id}`, data);
      
      // Update local state
      this.state.transactions = this.state.transactions.map(t => 
        (t.id === id || t._id === id) ? { ...t, ...updatedTransaction } : t
      );
      
      this.persistToStorage();
      
      // Notify subscribers
      this.notify('transactions:updated', this.state.transactions);
      this.notify('transaction:updated', updatedTransaction);
      
      return updatedTransaction;
    } catch (error) {
      console.error('Error updating transaction:', error);
      this.setError('transactions', 'Failed to update transaction');
      
      // Fallback: Update local state even if API fails
      const existingTransaction = this.state.transactions.find(t => t.id === id || t._id === id);
      if (existingTransaction) {
        const updatedTransaction = { ...existingTransaction, ...data, _offline: true };
        
        this.state.transactions = this.state.transactions.map(t => 
          (t.id === id || t._id === id) ? updatedTransaction : t
        );
        
        this.persistToStorage();
        
        this.notify('transactions:updated', this.state.transactions);
        this.notify('transaction:updated', updatedTransaction);
        
        return updatedTransaction;
      }
      
      throw error;
    } finally {
      this.setLoading('transactions', false);
    }
  }
  
  /**
   * Delete a transaction
   * @param {string} id - ID of transaction to delete
   */
  async deleteTransaction(id) {
    this.setLoading('transactions', true);
    
    try {
      // Delete from API
      await this.api.delete(`/transactions/${id}`);
      
      // Remove from local state
      const deletedTransaction = this.state.transactions.find(t => t.id === id || t._id === id);
      this.state.transactions = this.state.transactions.filter(t => t.id !== id && t._id !== id);
      
      this.persistToStorage();
      
      // Notify subscribers
      this.notify('transactions:updated', this.state.transactions);
      this.notify('transaction:deleted', deletedTransaction);
      
      return deletedTransaction;
    } catch (error) {
      console.error('Error deleting transaction:', error);
      this.setError('transactions', 'Failed to delete transaction');
      
      // Fallback: Delete from local state even if API fails
      const deletedTransaction = this.state.transactions.find(t => t.id === id || t._id === id);
      
      if (deletedTransaction) {
        this.state.transactions = this.state.transactions.filter(t => t.id !== id && t._id !== id);
        this.persistToStorage();
        
        this.notify('transactions:updated', this.state.transactions);
        this.notify('transaction:deleted', deletedTransaction);
        
        return deletedTransaction;
      }
      
      throw error;
    } finally {
      this.setLoading('transactions', false);
    }
  }
  
  // ==============================
  // Savings Goal Methods
  // ==============================
  
  async fetchSavingsGoals() {
    this.setLoading('savingsGoals', true);
    
    try {
      const savingsGoals = await this.api.get('/savings-goals');
      this.state.savingsGoals = savingsGoals;
      this.persistToStorage();
      this.notify('savingsGoals:updated', savingsGoals);
      return savingsGoals;
    } catch (error) {
      console.error('Error fetching savings goals:', error);
      this.setError('savingsGoals', 'Failed to fetch savings goals');
      throw error;
    } finally {
      this.setLoading('savingsGoals', false);
    }
  }
  
  async addSavingsGoal(goal) {
    this.setLoading('savingsGoals', true);
    
    try {
      const newGoal = await this.api.post('/savings-goals', goal);
      this.state.savingsGoals = [...this.state.savingsGoals, newGoal];
      this.persistToStorage();
      this.notify('savingsGoals:updated', this.state.savingsGoals);
      this.notify('savingsGoal:added', newGoal);
      return newGoal;
    } catch (error) {
      console.error('Error adding savings goal:', error);
      this.setError('savingsGoals', 'Failed to add savings goal');
      
      // Fallback
      const fallbackGoal = {
        id: Date.now().toString(),
        ...goal,
        _offline: true
      };
      
      this.state.savingsGoals = [...this.state.savingsGoals, fallbackGoal];
      this.persistToStorage();
      this.notify('savingsGoals:updated', this.state.savingsGoals);
      this.notify('savingsGoal:added', fallbackGoal);
      
      return fallbackGoal;
    } finally {
      this.setLoading('savingsGoals', false);
    }
  }
  
  async updateSavingsGoal(id, data) {
    this.setLoading('savingsGoals', true);
    
    try {
      const updatedGoal = await this.api.patch(`/savings-goals/${id}`, data);
      this.state.savingsGoals = this.state.savingsGoals.map(g => 
        (g.id === id || g._id === id) ? { ...g, ...updatedGoal } : g
      );
      this.persistToStorage();
      this.notify('savingsGoals:updated', this.state.savingsGoals);
      this.notify('savingsGoal:updated', updatedGoal);
      return updatedGoal;
    } catch (error) {
      console.error('Error updating savings goal:', error);
      this.setError('savingsGoals', 'Failed to update savings goal');
      
      // Fallback
      const existingGoal = this.state.savingsGoals.find(g => g.id === id || g._id === id);
      if (existingGoal) {
        const updatedGoal = { ...existingGoal, ...data, _offline: true };
        this.state.savingsGoals = this.state.savingsGoals.map(g => 
          (g.id === id || g._id === id) ? updatedGoal : g
        );
        this.persistToStorage();
        this.notify('savingsGoals:updated', this.state.savingsGoals);
        this.notify('savingsGoal:updated', updatedGoal);
        return updatedGoal;
      }
      
      throw error;
    } finally {
      this.setLoading('savingsGoals', false);
    }
  }
  
  async deleteSavingsGoal(id) {
    this.setLoading('savingsGoals', true);
    
    try {
      await this.api.delete(`/savings-goals/${id}`);
      const deletedGoal = this.state.savingsGoals.find(g => g.id === id || g._id === id);
      this.state.savingsGoals = this.state.savingsGoals.filter(g => g.id !== id && g._id !== id);
      this.persistToStorage();
      this.notify('savingsGoals:updated', this.state.savingsGoals);
      this.notify('savingsGoal:deleted', deletedGoal);
      return deletedGoal;
    } catch (error) {
      console.error('Error deleting savings goal:', error);
      this.setError('savingsGoals', 'Failed to delete savings goal');
      
      // Fallback
      const deletedGoal = this.state.savingsGoals.find(g => g.id === id || g._id === id);
      if (deletedGoal) {
        this.state.savingsGoals = this.state.savingsGoals.filter(g => g.id !== id && g._id !== id);
        this.persistToStorage();
        this.notify('savingsGoals:updated', this.state.savingsGoals);
        this.notify('savingsGoal:deleted', deletedGoal);
        return deletedGoal;
      }
      
      throw error;
    } finally {
      this.setLoading('savingsGoals', false);
    }
  }
  
  // ==============================
  // Budget Methods
  // ==============================
  
  async fetchBudgets() {
    this.setLoading('budgets', true);
    
    try {
      const budgets = await this.api.get('/budgets');
      this.state.budgets = budgets;
      this.persistToStorage();
      this.notify('budgets:updated', budgets);
      return budgets;
    } catch (error) {
      console.error('Error fetching budgets:', error);
      this.setError('budgets', 'Failed to fetch budgets');
      throw error;
    } finally {
      this.setLoading('budgets', false);
    }
  }
  
  async addBudget(budget) {
    this.setLoading('budgets', true);
    
    try {
      const newBudget = await this.api.post('/budgets', budget);
      this.state.budgets = [...this.state.budgets, newBudget];
      this.persistToStorage();
      this.notify('budgets:updated', this.state.budgets);
      this.notify('budget:added', newBudget);
      return newBudget;
    } catch (error) {
      console.error('Error adding budget:', error);
      this.setError('budgets', 'Failed to add budget');
      
      // Fallback
      const fallbackBudget = {
        id: Date.now().toString(),
        ...budget,
        _offline: true
      };
      
      this.state.budgets = [...this.state.budgets, fallbackBudget];
      this.persistToStorage();
      this.notify('budgets:updated', this.state.budgets);
      this.notify('budget:added', fallbackBudget);
      
      return fallbackBudget;
    } finally {
      this.setLoading('budgets', false);
    }
  }
  
  async updateBudget(id, data) {
    this.setLoading('budgets', true);
    
    try {
      const updatedBudget = await this.api.patch(`/budgets/${id}`, data);
      this.state.budgets = this.state.budgets.map(b => 
        (b.id === id || b._id === id) ? { ...b, ...updatedBudget } : b
      );
      this.persistToStorage();
      this.notify('budgets:updated', this.state.budgets);
      this.notify('budget:updated', updatedBudget);
      return updatedBudget;
    } catch (error) {
      console.error('Error updating budget:', error);
      this.setError('budgets', 'Failed to update budget');
      
      // Fallback
      const existingBudget = this.state.budgets.find(b => b.id === id || b._id === id);
      if (existingBudget) {
        const updatedBudget = { ...existingBudget, ...data, _offline: true };
        this.state.budgets = this.state.budgets.map(b => 
          (b.id === id || b._id === id) ? updatedBudget : b
        );
        this.persistToStorage();
        this.notify('budgets:updated', this.state.budgets);
        this.notify('budget:updated', updatedBudget);
        return updatedBudget;
      }
      
      throw error;
    } finally {
      this.setLoading('budgets', false);
    }
  }
  
  async deleteBudget(id) {
    this.setLoading('budgets', true);
    
    try {
      await this.api.delete(`/budgets/${id}`);
      const deletedBudget = this.state.budgets.find(b => b.id === id || b._id === id);
      this.state.budgets = this.state.budgets.filter(b => b.id !== id && b._id !== id);
      this.persistToStorage();
      this.notify('budgets:updated', this.state.budgets);
      this.notify('budget:deleted', deletedBudget);
      return deletedBudget;
    } catch (error) {
      console.error('Error deleting budget:', error);
      this.setError('budgets', 'Failed to delete budget');
      
      // Fallback
      const deletedBudget = this.state.budgets.find(b => b.id === id || b._id === id);
      if (deletedBudget) {
        this.state.budgets = this.state.budgets.filter(b => b.id !== id && b._id !== id);
        this.persistToStorage();
        this.notify('budgets:updated', this.state.budgets);
        this.notify('budget:deleted', deletedBudget);
        return deletedBudget;
      }
      
      throw error;
    } finally {
      this.setLoading('budgets', false);
    }
  }
  
  // ==============================
  // UI Methods
  // ==============================
  
  setTheme(theme) {
    this.state.ui.theme = theme;
    this.persistToStorage();
    this.notify('ui:themeChanged', theme);
  }
  
  setLoading(entity, isLoading) {
    this.state.ui.loading[entity] = isLoading;
    this.notify('ui:loadingChanged', { entity, isLoading });
  }
  
  setError(entity, error) {
    this.state.ui.errors[entity] = error;
    this.notify('ui:errorChanged', { entity, error });
  }
  
  // ==============================
  // User Methods
  // ==============================
  
  async loginUser(credentials) {
    try {
      const user = await this.api.post('/auth/login', credentials);
      this.state.user = user;
      // Save JWT token to localStorage
      if (user.token) {
        localStorage.setItem('token', user.token);
      }
      this.persistToStorage();
      this.notify('user:updated', user);
      
      // Fetch user data after login
      this.fetchInitialData();
      
      return user;
    } catch (error) {
      console.error('Error logging in:', error);
      this.setError('user', 'Failed to log in');
      throw error;
    }
  }
  
  /**
   * Log out the current user
   * - Clears all state data
   * - Removes JWT token from localStorage
   * - Notifies all subscribers
   */
  logoutUser() {
    console.log('StateManager: Logging out user');
    
    // Clear state
    this.state.user = null;
    this.state.transactions = [];
    this.state.savingsGoals = [];
    this.state.budgets = [];
    
    // Clear storage
    this.storage.remove('user');
    this.storage.remove('transactions');
    this.storage.remove('savingsGoals');
    this.storage.remove('budgets');
    
    // Remove JWT token
    localStorage.removeItem('token');
    
    // Notify subscribers
    this.notify('user:updated', null);
    this.notify('transactions:updated', []);
    this.notify('savingsGoals:updated', []);
    this.notify('budgets:updated', []);
    this.notify('auth:logout', null);
    
    console.log('StateManager: User logged out successfully');
  }
  
  async updateUser(data) {
    try {
      const updatedUser = await this.api.patch('/auth/me', data);
      this.state.user = { ...this.state.user, ...updatedUser };
      this.persistToStorage();
      this.notify('user:updated', this.state.user);
      return this.state.user;
    } catch (error) {
      console.error('Error updating user:', error);
      this.setError('user', 'Failed to update user');
      throw error;
    }
  }
  
  // ==============================
  // Analytics Methods
  // ==============================
  
  getTransactionStats() {
    const transactions = this.state.transactions;
    
    // Calculate totals
    const income = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      
    const expenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      
    const balance = income - expenses;
    
    // Calculate by category
    const byCategory = transactions.reduce((acc, t) => {
      const category = t.category || 'Uncategorized';
      if (!acc[category]) {
        acc[category] = 0;
      }
      
      const amount = parseFloat(t.amount);
      if (t.type === 'income') {
        acc[category] += amount;
      } else {
        acc[category] -= amount;
      }
      
      return acc;
    }, {});
    
    // Calculate by month
    const byMonth = transactions.reduce((acc, t) => {
      const date = new Date(t.date);
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!acc[month]) {
        acc[month] = { income: 0, expenses: 0 };
      }
      
      const amount = parseFloat(t.amount);
      if (t.type === 'income') {
        acc[month].income += amount;
      } else {
        acc[month].expenses += amount;
      }
      
      return acc;
    }, {});
    
    return {
      income,
      expenses,
      balance,
      byCategory,
      byMonth
    };
  }
  
  getSavingsProgress() {
    const goals = this.state.savingsGoals;
    const transactions = this.state.transactions;
    
    return goals.map(goal => {
      // Find contributions to this goal
      const contributions = transactions
        .filter(t => t.savingsGoalId === goal.id || t.savingsGoalId === goal._id)
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
        
      const targetAmount = parseFloat(goal.targetAmount);
      const progress = (contributions / targetAmount) * 100;
      
      return {
        ...goal,
        currentAmount: contributions,
        progress: Math.min(progress, 100),
        remaining: Math.max(targetAmount - contributions, 0)
      };
    });
  }
  
  getBudgetProgress() {
    const budgets = this.state.budgets;
    const transactions = this.state.transactions;
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    
    return budgets.map(budget => {
      // Find expenses in this category for current month
      const expenses = transactions
        .filter(t => {
          const transactionMonth = t.date.slice(0, 7);
          return t.type === 'expense' && 
                 t.category === budget.category && 
                 transactionMonth === currentMonth;
        })
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
        
      const limit = parseFloat(budget.limit);
      const progress = (expenses / limit) * 100;
      
      return {
        ...budget,
        spent: expenses,
        progress: Math.min(progress, 100),
        remaining: Math.max(limit - expenses, 0),
        isOverBudget: expenses > limit
      };
    });
  }
}

// Create and export singleton instance
export const store = new StateManager();

// For backwards compatibility with non-module scripts
window.stateManager = store;
