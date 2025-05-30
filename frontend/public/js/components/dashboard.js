/**
 * Dashboard Component - Connects the dashboard UI to the state management system
 * 
 * This component:
 * 1. Subscribes to state changes (transactions, goals, budgets)
 * 2. Renders the dashboard UI based on state
 * 3. Updates charts and statistics in real-time
 * 4. Handles loading and empty states
 */

import { store } from '../state/index.js';
import { chartManager, DataTransformers } from '../utils/chartUtils.js';

class DashboardComponent {
  constructor() {
    // Store references to DOM elements
    this.elements = {
      // Main cards
      balanceCard: document.querySelector('.card p.text-2xl'),
      incomeCard: document.querySelector('.card.income p.text-2xl'),
      expensesCard: document.querySelector('.card:not(.income):nth-child(3) p.text-2xl'),
      savingRateCard: document.querySelector('.card:nth-child(4) p.text-2xl'),
      balanceChange: document.getElementById('balanceChange'),
      
      // Category cards
      foodAmount: document.getElementById('foodAmount'),
      travelAmount: document.getElementById('travelAmount'),
      billsAmount: document.getElementById('billsAmount'),
      shoppingAmount: document.getElementById('shoppingAmount'),
      salaryAmount: document.getElementById('salaryAmount'),
      
      // Charts
      balanceChart: document.getElementById('balanceChart'),
      spendingChart: document.getElementById('spendingChart')
    };
    
    // Charts will be managed by chartManager
    
    // Initialize component state
    this.state = {
      transactions: [],
      savingsGoals: [],
      budgets: [],
      isLoading: {
        transactions: false,
        savingsGoals: false,
        budgets: false
      },
      errors: {}
    };
    
    // Subscribe to state changes
    this.subscribeToStateChanges();
    
    // Initial render with empty/loading state
    this.renderEmptyState();
    
    // Fetch data if not already loaded
    this.fetchInitialData();
  }
  
  /**
   * Subscribe to state changes
   */
  subscribeToStateChanges() {
    // Transaction state changes
    this.unsubscribeTransactions = store.subscribe('transactions:updated', this.handleTransactionsUpdated.bind(this));
    
    // Savings goals state changes
    this.unsubscribeSavingsGoals = store.subscribe('savingsGoals:updated', this.handleSavingsGoalsUpdated.bind(this));
    
    // Budget state changes
    this.unsubscribeBudgets = store.subscribe('budgets:updated', this.handleBudgetsUpdated.bind(this));
    
    // Loading state changes
    this.unsubscribeLoading = store.subscribe('ui:loadingChanged', this.handleLoadingChanged.bind(this));
    
    // Error state changes
    this.unsubscribeError = store.subscribe('ui:errorChanged', this.handleErrorChanged.bind(this));
  }
  
  /**
   * Handle transactions updated event
   * @param {Array} transactions - Updated transactions
   */
  handleTransactionsUpdated(transactions) {
    this.state.transactions = transactions;
    this.renderDashboard();
  }
  
  /**
   * Handle savings goals updated event
   * @param {Array} savingsGoals - Updated savings goals
   */
  handleSavingsGoalsUpdated(savingsGoals) {
    if (!Array.isArray(savingsGoals)) {
      this.state.savingsGoals = [];
    } else {
      this.state.savingsGoals = savingsGoals;
    }
    this.renderDashboard();
  }
  
  /**
   * Handle budgets updated event
   * @param {Array} budgets - Updated budgets
   */
  handleBudgetsUpdated(budgets) {
    this.state.budgets = budgets;
    this.renderDashboard();
  }
  
  /**
   * Handle loading state changed event
   * @param {Object} data - Loading state data
   */
  handleLoadingChanged(data) {
    this.state.isLoading[data.entity] = data.isLoading;
    this.updateLoadingState();
  }
  
  /**
   * Handle error state changed event
   * @param {Object} data - Error state data
   */
  handleErrorChanged(data) {
    this.state.errors[data.entity] = data.error;
    // Suppress "Service not available" error messages
    if (data.error && data.error.toLowerCase().includes('service not available')) {
      return;
    }
    this.showError(data.entity, data.error);
  }
  
  /**
   * Fetch initial data from the store
   */
  fetchInitialData() {
    // Check if we already have data in the store
    const transactions = store.getState('transactions');
    const savingsGoals = store.getState('savingsGoals');
    const budgets = store.getState('budgets');
    
    // If we have data, update our state
    if (transactions.length > 0) {
      this.state.transactions = transactions;
    } else {
      // Otherwise fetch from API
      store.dispatch('transactions:fetch');
    }
    
    if (savingsGoals.length > 0) {
      this.state.savingsGoals = savingsGoals;
    } else {
      store.dispatch('savingsGoals:fetch');
    }
    
    if (budgets.length > 0) {
      this.state.budgets = budgets;
    } else {
      store.dispatch('budgets:fetch');
    }
    
    // Render with whatever data we have
    this.renderDashboard();
  }
  
  /**
   * Update loading state UI
   */
  updateLoadingState() {
    const isLoading = 
      this.state.isLoading.transactions || 
      this.state.isLoading.savingsGoals || 
      this.state.isLoading.budgets;
    
    // Add loading indicators to cards if needed
    if (isLoading) {
      this.showLoadingState();
    } else {
      this.renderDashboard();
    }
  }
  
  /**
   * Show loading state
   */
  showLoadingState() {
    // Add loading indicators to cards
    const cards = document.querySelectorAll('.card p.text-2xl');
    cards.forEach(card => {
      if (!card.querySelector('.loading-indicator')) {
        const currentText = card.textContent;
        card.innerHTML = `
          <span class="loading-indicator inline-block animate-pulse">
            Loading...
          </span>
        `;
      }
    });
  }
  
  /**
   * Show error notification
   * @param {string} entity - Entity with error
   * @param {string} error - Error message
   */
  showError(entity, error) {
    if (!error) return;

    // Suppress "Service not available" error messages
    if (error.toLowerCase().includes('service not available')) {
      return;
    }
    
    const notificationDiv = document.createElement('div');
    notificationDiv.className = 'fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg transform transition-all duration-500 opacity-0 bg-red-500 text-white';
    notificationDiv.textContent = `Error loading ${entity}: ${error}`;
    document.body.appendChild(notificationDiv);
    
    setTimeout(() => notificationDiv.classList.remove('opacity-0'), 100);
    setTimeout(() => {
      notificationDiv.classList.add('opacity-0');
      setTimeout(() => notificationDiv.remove(), 500);
    }, 3000);
  }
  
  /**
   * Render empty state
   */
  renderEmptyState() {
    // Set all cards to zero
    if (this.elements.balanceCard) this.elements.balanceCard.textContent = '₹0';
    if (this.elements.incomeCard) this.elements.incomeCard.textContent = '₹0';
    if (this.elements.expensesCard) this.elements.expensesCard.textContent = '₹0';
    if (this.elements.savingRateCard) this.elements.savingRateCard.textContent = '₹0';
    if (this.elements.balanceChange) this.elements.balanceChange.textContent = '';
    
    // Set all category amounts to zero
    if (this.elements.foodAmount) this.elements.foodAmount.textContent = '₹0';
    if (this.elements.travelAmount) this.elements.travelAmount.textContent = '₹0';
    if (this.elements.billsAmount) this.elements.billsAmount.textContent = '₹0';
    if (this.elements.shoppingAmount) this.elements.shoppingAmount.textContent = '₹0';
    if (this.elements.salaryAmount) this.elements.salaryAmount.textContent = '₹0';
    
    // Initialize empty charts
    this.initializeCharts([]);
  }
  
  /**
   * Main render function for the dashboard
   */
  renderDashboard() {
    const transactions = this.state.transactions;
    const savingsGoals = this.state.savingsGoals;
    
    if (transactions.length === 0) {
      // If no transactions, show empty state
      this.renderEmptyState();
      return;
    }
    
    // Defensive check for savingsGoals before usage
    if (!Array.isArray(savingsGoals)) {
      this.state.savingsGoals = [];
    }
    
    // Calculate financial stats
    const stats = this.calculateFinancialStats(transactions);
    
    // Update main cards
    this.updateMainCards(stats);
    
    // Update category cards
    this.updateCategoryCards(stats.byCategory);
    
    // Update charts
    this.updateCharts(stats);
  }
  
  /**
   * Calculate financial statistics from transactions
   * @param {Array} transactions - Transactions array
   * @returns {Object} Financial statistics
   */
  calculateFinancialStats(transactions) {
    // Calculate totals
    let income = 0;
    let expenses = 0;
    
    // Category totals
    const byCategory = {
      food: 0,
      travel: 0,
      bills: 0,
      shopping: 0,
      salary: 0,
      other: 0
    };
    
    // Monthly data for charts
    const byMonth = {};
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    // Daily balance data for current month
    const dailyBalance = {};
    let runningBalance = 0;
    
    // Process each transaction
    transactions.forEach(tx => {
      const amount = parseFloat(tx.amount);
      const date = new Date(tx.date);
      const txMonth = date.getMonth();
      const txYear = date.getFullYear();
      const monthKey = `${txYear}-${String(txMonth + 1).padStart(2, '0')}`;
      const dayKey = date.getDate();
      
      // Skip transactions with invalid amounts
      if (isNaN(amount)) return;
      
      // Update income/expense totals
      if (tx.type === 'income') {
        income += Math.abs(amount);
      } else if (tx.type === 'expense') {
        expenses += Math.abs(amount);
      }
      
      // Update category totals
      const category = tx.category || 'other';
      if (byCategory[category] !== undefined) {
        if (tx.type === 'income') {
          byCategory[category] += Math.abs(amount);
        } else if (tx.type === 'expense') {
          byCategory[category] -= Math.abs(amount);
        }
      } else {
        if (tx.type === 'income') {
          byCategory.other += Math.abs(amount);
        } else if (tx.type === 'expense') {
          byCategory.other -= Math.abs(amount);
        }
      }
      
      // Update monthly data
      if (!byMonth[monthKey]) {
        byMonth[monthKey] = { income: 0, expenses: 0 };
      }
      
      if (tx.type === 'income') {
        byMonth[monthKey].income += Math.abs(amount);
      } else if (tx.type === 'expense') {
        byMonth[monthKey].expenses += Math.abs(amount);
      }
      
      // Update daily balance for current month
      if (txMonth === currentMonth && txYear === currentYear) {
        if (!dailyBalance[dayKey]) {
          dailyBalance[dayKey] = 0;
        }
        
        if (tx.type === 'income') {
          dailyBalance[dayKey] += Math.abs(amount);
        } else if (tx.type === 'expense') {
          dailyBalance[dayKey] -= Math.abs(amount);
        }
      }
    });
    
    // Calculate balance and saving rate
    const balance = income - expenses;
    const savingRate = income > 0 ? ((income - expenses) / income) * 100 : 0;
    
    // Calculate running balance for chart
    const days = new Date(currentYear, currentMonth + 1, 0).getDate(); // Last day of current month
    const dailyBalanceArray = [];
    
    for (let i = 1; i <= days; i++) {
      runningBalance += (dailyBalance[i] || 0);
      dailyBalanceArray.push(runningBalance);
    }
    
    // Compute weekly balance change (last 7 days)
    let weeklyChange = 0;
    if (dailyBalanceArray.length > 7) {
      const n = dailyBalanceArray.length;
      const curr = dailyBalanceArray[n - 1];
      const prev = dailyBalanceArray[n - 8];
      if (prev !== 0) {
        weeklyChange = ((curr - prev) / Math.abs(prev)) * 100;
      }
    }
    
    return {
      income,
      expenses,
      balance,
      savingRate,
      byCategory,
      byMonth,
      dailyBalanceArray,
      weeklyChange
    };
  }
  
  /**
   * Update main dashboard cards
   * @param {Object} stats - Financial statistics
   */
  updateMainCards(stats) {
    // Format currency
    const formatCurrency = (amount) => {
      return '₹' + amount.toLocaleString('en-IN', { maximumFractionDigits: 0 });
    };
    
    // Update balance card
    if (this.elements.balanceCard) {
      this.elements.balanceCard.textContent = formatCurrency(stats.balance);
    }
    
    // Update income card
    if (this.elements.incomeCard) {
      this.elements.incomeCard.textContent = formatCurrency(stats.income);
    }
    
    // Update expenses card
    if (this.elements.expensesCard) {
      this.elements.expensesCard.textContent = formatCurrency(stats.expenses);
    }
    
    // Update saving rate card
    if (this.elements.savingRateCard) {
      this.elements.savingRateCard.textContent = formatCurrency(stats.savingRate) + '%';
    }
    
    // Update weekly balance change
    const changeEl = document.getElementById('balanceChange');
    if (changeEl && typeof stats.weeklyChange === 'number') {
      const change = stats.weeklyChange;
      const sign = change >= 0 ? '+' : '';
      changeEl.textContent = `${sign}${change.toFixed(1)}% from last week`;
      changeEl.classList.toggle('text-green-500', change >= 0);
      changeEl.classList.toggle('text-red-500', change < 0);
    }
  }
  
  /**
   * Update category cards
   * @param {Object} categoryStats - Category statistics
   */
  updateCategoryCards(categoryStats) {
    // Format currency
    const formatCurrency = (amount) => {
      return '₹' + Math.abs(amount).toLocaleString('en-IN', { maximumFractionDigits: 0 });
    };
    
    // Update food amount
    if (this.elements.foodAmount) {
      this.elements.foodAmount.textContent = formatCurrency(categoryStats.food);
    }
    
    // Update travel amount
    if (this.elements.travelAmount) {
      this.elements.travelAmount.textContent = formatCurrency(categoryStats.travel);
    }
    
    // Update bills amount
    if (this.elements.billsAmount) {
      this.elements.billsAmount.textContent = formatCurrency(categoryStats.bills);
    }
    
    // Update shopping amount
    if (this.elements.shoppingAmount) {
      this.elements.shoppingAmount.textContent = formatCurrency(categoryStats.shopping);
    }
    
    // Update salary amount
    if (this.elements.salaryAmount) {
      this.elements.salaryAmount.textContent = formatCurrency(categoryStats.salary);
    }
  }
  
  /**
   * Initialize charts with empty data
   */
  initializeCharts() {
    // Initialize balance chart
    chartManager.initLineChart('balanceChart', {
      data: {
        labels: Array.from({ length: 30 }, (_, i) => i + 1),
        datasets: [{
          label: 'Current Balance (₹)',
          data: Array(30).fill(0),
          fill: true,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.2)',
          tension: 0.3
        }]
      },
      chartOptions: {
        scales: {
          x: {
            title: {
              display: true,
              text: 'Date (This Month)'
            }
          },
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Balance (₹)'
            }
          }
        }
      }
    });
    
    // Initialize spending chart
    chartManager.initBarChart('spendingChart', {
      data: {
        labels: ['Food', 'Travel', 'Bills', 'Shopping', 'Other'],
        datasets: [{
          label: 'Amount Spent (₹)',
          data: [0, 0, 0, 0, 0],
          backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
        }]
      },
      chartOptions: {
        plugins: {
          legend: { display: false }
        }
      }
    });
    
    // Subscribe charts to state changes
    this.subscribeChartsToState();
  }
  
  /**
   * Subscribe charts to state changes
   */
  subscribeChartsToState() {
    // Subscribe balance chart to transactions updates
    chartManager.subscribeChart('balanceChart', 'transactions:updated', 
      DataTransformers.balanceOverTime
    );
    
    // Subscribe spending chart to transactions updates
    chartManager.subscribeChart('spendingChart', 'transactions:updated', 
      DataTransformers.spendingByCategory
    );
  }
  
  /**
   * Update charts with new data
   * @param {Object} stats - Financial statistics
   */
  updateCharts(stats) {
    // Charts are now updated automatically through subscriptions
    // This method is kept for backward compatibility
  }
  
  /**
   * Clean up component
   */
  destroy() {
    // Unsubscribe from state changes
    this.unsubscribeTransactions && this.unsubscribeTransactions();
    this.unsubscribeSavingsGoals && this.unsubscribeSavingsGoals();
    this.unsubscribeBudgets && this.unsubscribeBudgets();
    this.unsubscribeLoading && this.unsubscribeLoading();
    this.unsubscribeError && this.unsubscribeError();
    
    // Destroy charts
    chartManager.destroyAll();
  }
}

// Initialize the dashboard component when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.dashboardComponent = new DashboardComponent();
});

// Export the component
export default DashboardComponent;
