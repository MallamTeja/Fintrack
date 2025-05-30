/**
 * Insights Component - Connects the insights page to the state management system
 * 
 * This component:
 * 1. Subscribes to state changes (transactions, goals, budgets)
 * 2. Renders the insights UI based on state
 * 3. Updates charts and statistics in real-time
 * 4. Handles loading and empty states
 * 5. Supports different date range filters
 */

import { store } from '../state/index.js';
import { chartManager, DataTransformers } from '../utils/chartUtils.js';

class InsightsComponent {
  constructor() {
    // Store references to DOM elements
    this.elements = {
      // Stat cards
      incomeCard: document.querySelector('.income-card .text-2xl'),
      expenseCard: document.querySelector('.expense-card .text-2xl'),
      savingsCard: document.querySelector('.savings-card .text-2xl'),
      savingsPercentage: document.querySelector('.savings-card .text-sm'),
      transactionsCard: document.querySelector('.transactions-card .text-2xl'),
      
      // Filter elements
      dateFilter: document.getElementById('dateFilter'),
      
      // Charts
      expenseChart: document.getElementById('expenseChart'),
      trendChart: document.getElementById('trendChart'),
      
      // Progress bars
      progressBars: document.querySelectorAll('[class^="progress-"]')
    };
    
    // Initialize component state
    this.state = {
      transactions: [],
      savingsGoals: [],
      budgets: [],
      dateRange: 'monthly',
      isLoading: {
        transactions: false,
        savingsGoals: false,
        budgets: false
      },
      errors: {}
    };
    
    // Subscribe to state changes
    this.subscribeToStateChanges();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Initial render with empty/loading state
    this.renderEmptyState();
    
    // Initialize charts
    this.initializeCharts();
    
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
   * Set up event listeners
   */
  setupEventListeners() {
    // Date filter change
    if (this.elements.dateFilter) {
      this.elements.dateFilter.addEventListener('change', (e) => {
        this.state.dateRange = e.target.value;
        this.renderInsights();
      });
    }
  }
  
  /**
   * Handle transactions updated event
   * @param {Array} transactions - Updated transactions
   */
  handleTransactionsUpdated(transactions) {
    this.state.transactions = transactions;
    this.renderInsights();
  }
  
  /**
   * Handle savings goals updated event
   * @param {Array} savingsGoals - Updated savings goals
   */
  handleSavingsGoalsUpdated(savingsGoals) {
    // Defensive check for undefined or null savingsGoals
    if (!Array.isArray(savingsGoals)) {
      this.state.savingsGoals = [];
    } else {
      this.state.savingsGoals = savingsGoals;
    }
    this.renderInsights();
  }
  
  /**
   * Handle budgets updated event
   * @param {Array} budgets - Updated budgets
   */
  handleBudgetsUpdated(budgets) {
    this.state.budgets = budgets;
    this.renderInsights();
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
    this.renderInsights();
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
      this.renderInsights();
    }
  }
  
  /**
   * Show loading state
   */
  showLoadingState() {
    // Add loading indicators to cards
    const cards = document.querySelectorAll('.stat-card .text-2xl');
    cards.forEach(card => {
      if (!card.querySelector('.loading-indicator')) {
        card.innerHTML = `
          <span class="loading-indicator inline-block animate-pulse">
            Loading...
          </span>
        `;
      }
    });
    
    // Add loading overlay to charts
    const charts = document.querySelectorAll('.chart-container');
    charts.forEach(chart => {
      if (!chart.querySelector('.chart-loading-overlay')) {
        const overlay = document.createElement('div');
        overlay.className = 'chart-loading-overlay absolute inset-0 bg-white dark:bg-gray-800 bg-opacity-75 dark:bg-opacity-75 flex items-center justify-center z-10';
        overlay.innerHTML = `
          <div class="animate-pulse text-blue-500">
            <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
          </div>
        `;
        chart.style.position = 'relative';
        chart.appendChild(overlay);
      }
    });
  }
  
  /**
   * Hide loading state
   */
  hideLoadingState() {
    // Remove loading indicators from cards
    const loadingIndicators = document.querySelectorAll('.loading-indicator');
    loadingIndicators.forEach(indicator => {
      indicator.remove();
    });
    
    // Remove loading overlays from charts
    const overlays = document.querySelectorAll('.chart-loading-overlay');
    overlays.forEach(overlay => {
      overlay.remove();
    });
  }
  
  /**
   * Show error notification
   * @param {string} entity - Entity with error
   * @param {string} error - Error message
   */
  showError(entity, error) {
    if (!error) return;
    
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
    if (this.elements.incomeCard) this.elements.incomeCard.textContent = '₹0';
    if (this.elements.expenseCard) this.elements.expenseCard.textContent = '₹0';
    if (this.elements.savingsCard) this.elements.savingsCard.textContent = '₹0';
    if (this.elements.savingsPercentage) this.elements.savingsPercentage.textContent = '0% of income';
    if (this.elements.transactionsCard) this.elements.transactionsCard.textContent = '0';
    
    // Set progress bars to 0%
    this.elements.progressBars.forEach(bar => {
      bar.style.width = '0%';
    });
  }
  
  /**
   * Initialize charts
   */
  initializeCharts() {
    // Initialize expense chart (doughnut)
    chartManager.initDoughnutChart('expenseChart', {
      data: {
        labels: ['Food', 'Rent', 'Transport', 'Entertainment', 'Utilities'],
        datasets: [{
          data: [0, 0, 0, 0, 0],
          backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
        }]
      },
      chartOptions: {
        plugins: {
          legend: {
            position: 'right'
          }
        }
      }
    });
    
    // Initialize trend chart (bar)
    chartManager.initBarChart('trendChart', {
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [
          {
            label: 'Income',
            data: [0, 0, 0, 0, 0, 0],
            backgroundColor: '#10b981'
          },
          {
            label: 'Expenses',
            data: [0, 0, 0, 0, 0, 0],
            backgroundColor: '#ef4444'
          }
        ]
      },
      chartOptions: {
        scales: {
          x: {
            stacked: false
          },
          y: {
            stacked: false,
            beginAtZero: true
          }
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
    // Create custom data transformer for expense chart based on date range
    const expenseChartTransformer = (transactions) => {
      // Filter transactions based on date range
      const filteredTransactions = this.filterTransactionsByDateRange(transactions);
      
      // Get spending by category data
      return DataTransformers.spendingByCategory(filteredTransactions);
    };
    
    // Create custom data transformer for trend chart based on date range
    const trendChartTransformer = (transactions) => {
      // Filter transactions based on date range
      const filteredTransactions = this.filterTransactionsByDateRange(transactions);
      
      // Get income vs expenses data
      return DataTransformers.incomeVsExpenses(filteredTransactions);
    };
    
    // Subscribe expense chart to transactions updates
    chartManager.subscribeChart('expenseChart', 'transactions:updated', expenseChartTransformer);
    
    // Subscribe trend chart to transactions updates
    chartManager.subscribeChart('trendChart', 'transactions:updated', trendChartTransformer);
  }
  
  /**
   * Filter transactions by date range
   * @param {Array} transactions - Transactions array
   * @returns {Array} Filtered transactions
   */
  filterTransactionsByDateRange(transactions) {
    if (!transactions || transactions.length === 0) {
      return [];
    }
    
    const today = new Date();
    const dateRange = this.state.dateRange;
    
    // Filter transactions based on date range
    return transactions.filter(tx => {
      const txDate = new Date(tx.date);
      
      if (dateRange === 'weekly') {
        // Get transactions from the last 7 days
        const weekAgo = new Date(today);
        weekAgo.setDate(today.getDate() - 7);
        return txDate >= weekAgo;
      } else if (dateRange === 'monthly') {
        // Get transactions from the current month
        return txDate.getMonth() === today.getMonth() && 
               txDate.getFullYear() === today.getFullYear();
      } else if (dateRange === 'yearly') {
        // Get transactions from the current year
        return txDate.getFullYear() === today.getFullYear();
      } else if (dateRange === 'all') {
        // Get all transactions
        return true;
      }
      
      // Default to monthly
      return txDate.getMonth() === today.getMonth() && 
             txDate.getFullYear() === today.getFullYear();
    });
  }
  
  /**
   * Main render function for the insights page
   */
  renderInsights() {
    const transactions = this.state.transactions;
    
    // Hide loading state
    this.hideLoadingState();
    
    if (transactions.length === 0) {
      // If no transactions, show empty state
      this.renderEmptyState();
      return;
    }
    
    // Filter transactions based on date range
    const filteredTransactions = this.filterTransactionsByDateRange(transactions);
    
    // Calculate financial stats
    const stats = this.calculateFinancialStats(filteredTransactions);
    
    // Update stat cards
    this.updateStatCards(stats);
    
    // Update progress bars
    this.updateProgressBars(stats);
    
    // Update charts (now handled by chart subscriptions)
    // The charts will update automatically when transactions change
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
    let transactionCount = transactions.length;
    
    // Category totals
    const categories = {};
    
    // Process each transaction
    transactions.forEach(tx => {
      const amount = parseFloat(tx.amount);
      
      // Skip transactions with invalid amounts
      if (isNaN(amount)) return;
      
      // Update income/expense totals
      if (tx.type === 'income' || amount > 0) {
        income += Math.abs(amount);
      } else {
        expenses += Math.abs(amount);
      }
      
      // Update category totals for expenses
      if (tx.type === 'expense' || amount < 0) {
        const category = tx.category || 'Other';
        if (!categories[category]) {
          categories[category] = 0;
        }
        categories[category] += Math.abs(amount);
      }
    });
    
    // Calculate savings and percentage
    const savings = income - expenses;
    const savingsPercentage = income > 0 ? Math.round((savings / income) * 100) : 0;
    
    // Sort categories by amount (descending)
    const sortedCategories = Object.entries(categories)
      .sort((a, b) => b[1] - a[1])
      .reduce((obj, [key, value]) => {
        obj[key] = value;
        return obj;
      }, {});
    
    // Calculate category percentages
    const categoryPercentages = {};
    const totalExpenses = expenses;
    
    Object.entries(sortedCategories).forEach(([category, amount]) => {
      categoryPercentages[category] = totalExpenses > 0 ? Math.round((amount / totalExpenses) * 100) : 0;
    });
    
    return {
      income,
      expenses,
      savings,
      savingsPercentage,
      transactionCount,
      categories: sortedCategories,
      categoryPercentages
    };
  }
  
  /**
   * Update stat cards with financial statistics
   * @param {Object} stats - Financial statistics
   */
  updateStatCards(stats) {
    // Format currency
    const formatCurrency = (amount) => {
      return '₹' + amount.toLocaleString('en-IN', { maximumFractionDigits: 0 });
    };
    
    // Update income card
    if (this.elements.incomeCard) {
      this.elements.incomeCard.textContent = formatCurrency(stats.income);
    }
    
    // Update expense card
    if (this.elements.expenseCard) {
      this.elements.expenseCard.textContent = formatCurrency(stats.expenses);
    }
    
    // Update savings card
    if (this.elements.savingsCard) {
      this.elements.savingsCard.textContent = formatCurrency(stats.savings);
    }
    
    // Update savings percentage
    if (this.elements.savingsPercentage) {
      this.elements.savingsPercentage.textContent = `${stats.savingsPercentage}% of income`;
    }
    
    // Update transactions count
    if (this.elements.transactionsCard) {
      this.elements.transactionsCard.textContent = stats.transactionCount;
    }
  }
  
  /**
   * Update progress bars with category percentages
   * @param {Object} stats - Financial statistics
   */
  updateProgressBars(stats) {
    // Get top categories
    const topCategories = Object.entries(stats.categoryPercentages)
      .slice(0, 4)
      .map(([category, percentage]) => ({ category, percentage }));
    
    // Update progress bars
    this.elements.progressBars.forEach((bar, index) => {
      if (index < topCategories.length) {
        bar.style.width = `${topCategories[index].percentage}%`;
      } else {
        bar.style.width = '0%';
      }
    });
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
    
    // Remove event listeners
    if (this.elements.dateFilter) {
      this.elements.dateFilter.removeEventListener('change');
    }
    
    // Destroy charts (handled by chartManager)
  }
}

// Initialize the insights component when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.insightsComponent = new InsightsComponent();
});

// Export the component
export default InsightsComponent;
