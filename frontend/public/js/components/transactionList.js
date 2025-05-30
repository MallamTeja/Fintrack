/**
 * TransactionList Component - Example of using the state manager
 * 
 * This component demonstrates how to:
 * 1. Subscribe to state changes
 * 2. Render based on state
 * 3. Dispatch actions to modify state
 */

import { store } from '../state/index.js';

class TransactionList {
  constructor(containerId) {
    // Store the container element
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error(`Container element with ID "${containerId}" not found`);
      return;
    }
    
    // Initialize component state
    this.transactions = [];
    this.isLoading = false;
    this.error = null;
    
    // Subscribe to state changes
    this.unsubscribeTransactions = store.subscribe('transactions:updated', this.handleTransactionsUpdated.bind(this));
    this.unsubscribeLoading = store.subscribe('ui:loadingChanged', this.handleLoadingChanged.bind(this));
    this.unsubscribeError = store.subscribe('ui:errorChanged', this.handleErrorChanged.bind(this));
    
    // Initial render
    this.render();
    
    // Fetch transactions if not already loaded
    if (store.getState('transactions').length === 0) {
      store.dispatch('transactions:fetch');
    } else {
      // Use existing transactions from state
      this.transactions = store.getState('transactions');
      this.render();
    }
  }
  
  /**
   * Handle transactions updated event
   * @param {Array} transactions - Updated transactions
   */
  handleTransactionsUpdated(transactions) {
    this.transactions = transactions;
    this.render();
  }
  
  /**
   * Handle loading state changed event
   * @param {Object} data - Loading state data
   */
  handleLoadingChanged(data) {
    if (data.entity === 'transactions') {
      this.isLoading = data.isLoading;
      this.render();
    }
  }
  
  /**
   * Handle error state changed event
   * @param {Object} data - Error state data
   */
  handleErrorChanged(data) {
    if (data.entity === 'transactions') {
      this.error = data.error;
      this.render();
    }
  }
  
  /**
   * Add a new transaction
   * @param {Object} transaction - Transaction to add
   */
  addTransaction(transaction) {
    store.dispatch('transaction:add', transaction);
  }
  
  /**
   * Delete a transaction
   * @param {string} id - ID of transaction to delete
   */
  deleteTransaction(id) {
    store.dispatch('transaction:delete', id);
  }
  
  /**
   * Update a transaction
   * @param {string} id - ID of transaction to update
   * @param {Object} data - Updated transaction data
   */
  updateTransaction(id, data) {
    store.dispatch('transaction:update', { id, data });
  }
  
  /**
   * Render the component
   */
  render() {
    // Clear the container
    this.container.innerHTML = '';
    
    // Show loading state
    if (this.isLoading) {
      this.container.innerHTML = '<div class="loading">Loading transactions...</div>';
      return;
    }
    
    // Show error state
    if (this.error) {
      this.container.innerHTML = `<div class="error">Error: ${this.error}</div>`;
      return;
    }
    
    // Show empty state
    if (this.transactions.length === 0) {
      this.container.innerHTML = `
        <div class="empty-state">
          <p>No transactions found</p>
          <button id="add-transaction-btn" class="btn">Add Transaction</button>
        </div>
      `;
      
      // Add event listener to the button
      const addButton = this.container.querySelector('#add-transaction-btn');
      if (addButton) {
        addButton.addEventListener('click', () => {
          // Show transaction form or modal
          this.showTransactionForm();
        });
      }
      
      return;
    }
    
    // Create transaction list
    const transactionList = document.createElement('ul');
    transactionList.className = 'transaction-list';
    
    // Add transactions to the list
    this.transactions.forEach(transaction => {
      const listItem = document.createElement('li');
      listItem.className = `transaction-item ${transaction.type}`;
      listItem.dataset.id = transaction.id || transaction._id;
      
      // Format amount with currency symbol
      const amount = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: transaction.currency || 'USD'
      }).format(transaction.amount);
      
      // Format date
      const date = new Date(transaction.date).toLocaleDateString();
      
      // Create transaction item content
      listItem.innerHTML = `
        <div class="transaction-info">
          <div class="transaction-title">${transaction.description}</div>
          <div class="transaction-category">${transaction.category || 'Uncategorized'}</div>
          <div class="transaction-date">${date}</div>
        </div>
        <div class="transaction-amount ${transaction.type}">${amount}</div>
        <div class="transaction-actions">
          <button class="edit-btn" data-id="${transaction.id || transaction._id}">Edit</button>
          <button class="delete-btn" data-id="${transaction.id || transaction._id}">Delete</button>
        </div>
      `;
      
      // Add to list
      transactionList.appendChild(listItem);
    });
    
    // Add the list to the container
    this.container.appendChild(transactionList);
    
    // Add event listeners to buttons
    this.addEventListeners();
  }
  
  /**
   * Add event listeners to transaction items
   */
  addEventListeners() {
    // Edit buttons
    const editButtons = this.container.querySelectorAll('.edit-btn');
    editButtons.forEach(button => {
      button.addEventListener('click', (event) => {
        const id = event.target.dataset.id;
        const transaction = this.transactions.find(t => (t.id === id || t._id === id));
        if (transaction) {
          this.showTransactionForm(transaction);
        }
      });
    });
    
    // Delete buttons
    const deleteButtons = this.container.querySelectorAll('.delete-btn');
    deleteButtons.forEach(button => {
      button.addEventListener('click', (event) => {
        const id = event.target.dataset.id;
        if (confirm('Are you sure you want to delete this transaction?')) {
          this.deleteTransaction(id);
        }
      });
    });
  }
  
  /**
   * Show transaction form for adding or editing
   * @param {Object} [transaction] - Transaction to edit (if any)
   */
  showTransactionForm(transaction = null) {
    // Create form container
    const formContainer = document.createElement('div');
    formContainer.className = 'transaction-form-container';
    
    // Create form
    const form = document.createElement('form');
    form.className = 'transaction-form';
    form.innerHTML = `
      <h2>${transaction ? 'Edit Transaction' : 'Add Transaction'}</h2>
      
      <div class="form-group">
        <label for="description">Description</label>
        <input type="text" id="description" name="description" value="${transaction?.description || ''}" required>
      </div>
      
      <div class="form-group">
        <label for="amount">Amount</label>
        <input type="number" id="amount" name="amount" step="0.01" value="${transaction?.amount || ''}" required>
      </div>
      
      <div class="form-group">
        <label for="type">Type</label>
        <select id="type" name="type" required>
          <option value="income" ${transaction?.type === 'income' ? 'selected' : ''}>Income</option>
          <option value="expense" ${transaction?.type === 'expense' ? 'selected' : ''}>Expense</option>
        </select>
      </div>
      
      <div class="form-group">
        <label for="category">Category</label>
        <input type="text" id="category" name="category" value="${transaction?.category || ''}">
      </div>
      
      <div class="form-group">
        <label for="date">Date</label>
        <input type="date" id="date" name="date" value="${transaction?.date ? new Date(transaction.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}" required>
      </div>
      
      <div class="form-actions">
        <button type="button" class="cancel-btn">Cancel</button>
        <button type="submit" class="submit-btn">${transaction ? 'Update' : 'Add'}</button>
      </div>
    `;
    
    // Add form to container
    formContainer.appendChild(form);
    
    // Add form container to document body
    document.body.appendChild(formContainer);
    
    // Add event listeners
    const cancelButton = form.querySelector('.cancel-btn');
    cancelButton.addEventListener('click', () => {
      document.body.removeChild(formContainer);
    });
    
    // Form submit
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      
      // Get form data
      const formData = new FormData(form);
      const transactionData = {
        description: formData.get('description'),
        amount: parseFloat(formData.get('amount')),
        type: formData.get('type'),
        category: formData.get('category') || 'Uncategorized',
        date: new Date(formData.get('date')).toISOString()
      };
      
      // Add or update transaction
      if (transaction) {
        this.updateTransaction(transaction.id || transaction._id, transactionData);
      } else {
        this.addTransaction(transactionData);
      }
      
      // Remove form
      document.body.removeChild(formContainer);
    });
  }
  
  /**
   * Clean up component
   */
  destroy() {
    // Unsubscribe from state changes
    this.unsubscribeTransactions && this.unsubscribeTransactions();
    this.unsubscribeLoading && this.unsubscribeLoading();
    this.unsubscribeError && this.unsubscribeError();
  }
}

// Export the component
export default TransactionList;

// For backwards compatibility with non-module scripts
window.TransactionList = TransactionList;
