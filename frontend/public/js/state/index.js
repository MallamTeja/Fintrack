// Simple state management for the application
const store = {
  state: {
    budgets: [],
    transactions: [],
    user: null,
    loading: false,
    error: null
  },
  
  listeners: {},
  
  // Subscribe to state changes
  subscribe(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    };
  },
  
  // Trigger event listeners
  notify(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  },
  
  // Update state and notify listeners
  setState(key, value) {
    this.state[key] = value;
    this.notify(`${key}:updated`, value);
  },
  
  // Handle actions
  async dispatch(action, payload) {
    switch (action) {
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
      // Add other actions as needed
      default:
        console.warn(`Action ${action} not recognized`);
    }
  },
  
  // API methods
  async fetchBudgets() {
    try {
      this.setState('loading', true);
      const response = await fetch('/api/budgets');
      if (!response.ok) throw new Error('Failed to fetch budgets');
      
      const budgets = await response.json();
      this.setState('budgets', budgets);
      return budgets;
    } catch (error) {
      console.error('Error fetching budgets:', error);
      this.setState('error', error.message);
    } finally {
      this.setState('loading', false);
    }
  },
  
  async addBudget(data) {
    try {
      this.setState('loading', true);
      const response = await fetch('/api/budgets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) throw new Error('Failed to add budget');
      
      const newBudget = await response.json();
      const updatedBudgets = [...this.state.budgets, newBudget];
      this.setState('budgets', updatedBudgets);
      return newBudget;
    } catch (error) {
      console.error('Error adding budget:', error);
      this.setState('error', error.message);
    } finally {
      this.setState('loading', false);
    }
  },
  
  async updateBudget(id, data) {
    try {
      this.setState('loading', true);
      const response = await fetch(`/api/budgets/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) throw new Error('Failed to update budget');
      
      const updatedBudget = await response.json();
      const updatedBudgets = this.state.budgets.map(b => 
        b._id === id ? updatedBudget : b
      );
      this.setState('budgets', updatedBudgets);
      return updatedBudget;
    } catch (error) {
      console.error('Error updating budget:', error);
      this.setState('error', error.message);
    } finally {
      this.setState('loading', false);
    }
  },
  
  async deleteBudget(id) {
    try {
      this.setState('loading', true);
      const response = await fetch(`/api/budgets/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) throw new Error('Failed to delete budget');
      
      const updatedBudgets = this.state.budgets.filter(b => b._id !== id);
      this.setState('budgets', updatedBudgets);
    } catch (error) {
      console.error('Error deleting budget:', error);
      this.setState('error', error.message);
    } finally {
      this.setState('loading', false);
    }
  }
};

export { store };