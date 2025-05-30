/**
 * Chart Utilities - Reactive Chart.js integration with state management
 * 
 * This module provides utilities for:
 * - Creating and initializing Chart.js charts
 * - Updating charts reactively based on state changes
 * - Smooth transitions for data updates
 * - Consistent styling and configuration
 */

import { store } from '../state/index.js';

/**
 * Chart configuration presets for consistent styling
 */
export const ChartConfig = {
  // Color palettes
  colors: {
    primary: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6'],
    income: '#10b981',
    expense: '#ef4444',
    balance: '#3b82f6',
    savings: '#8b5cf6',
    
    // Background colors with transparency
    backgroundColors: {
      primary: 'rgba(59, 130, 246, 0.2)',
      income: 'rgba(16, 185, 129, 0.2)',
      expense: 'rgba(239, 68, 68, 0.2)',
      balance: 'rgba(59, 130, 246, 0.2)',
      savings: 'rgba(139, 92, 246, 0.2)'
    }
  },
  
  // Animation settings
  animation: {
    duration: 800,
    easing: 'easeOutQuart'
  },
  
  // Common chart options
  defaultOptions: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top'
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += new Intl.NumberFormat('en-IN', { 
                style: 'currency', 
                currency: 'INR',
                maximumFractionDigits: 0
              }).format(context.parsed.y);
            }
            return label;
          }
        }
      }
    }
  }
};

/**
 * Chart factory - creates different types of charts with consistent styling
 */
export class ChartFactory {
  /**
   * Create a line chart
   * @param {HTMLCanvasElement} canvas - Canvas element
   * @param {Object} options - Chart options
   * @returns {Chart} Chart instance
   */
  static createLineChart(canvas, options = {}) {
    if (!canvas) return null;
    
    const ctx = canvas.getContext('2d');
    const defaultData = {
      labels: [],
      datasets: [{
        label: 'Data',
        data: [],
        fill: true,
        borderColor: ChartConfig.colors.primary[0],
        backgroundColor: ChartConfig.colors.backgroundColors.primary,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    };
    
    const defaultOptions = {
      ...ChartConfig.defaultOptions,
      scales: {
        x: {
          grid: {
            display: false
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(200, 200, 200, 0.1)'
          }
        }
      },
      animation: ChartConfig.animation
    };
    
    return new Chart(ctx, {
      type: 'line',
      data: options.data || defaultData,
      options: { ...defaultOptions, ...options.chartOptions }
    });
  }
  
  /**
   * Create a bar chart
   * @param {HTMLCanvasElement} canvas - Canvas element
   * @param {Object} options - Chart options
   * @returns {Chart} Chart instance
   */
  static createBarChart(canvas, options = {}) {
    if (!canvas) return null;
    
    const ctx = canvas.getContext('2d');
    const defaultData = {
      labels: [],
      datasets: [{
        label: 'Data',
        data: [],
        backgroundColor: ChartConfig.colors.primary,
        borderRadius: 4
      }]
    };
    
    const defaultOptions = {
      ...ChartConfig.defaultOptions,
      scales: {
        x: {
          grid: {
            display: false
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(200, 200, 200, 0.1)'
          }
        }
      },
      animation: ChartConfig.animation
    };
    
    return new Chart(ctx, {
      type: 'bar',
      data: options.data || defaultData,
      options: { ...defaultOptions, ...options.chartOptions }
    });
  }
  
  /**
   * Create a doughnut chart
   * @param {HTMLCanvasElement} canvas - Canvas element
   * @param {Object} options - Chart options
   * @returns {Chart} Chart instance
   */
  static createDoughnutChart(canvas, options = {}) {
    if (!canvas) return null;
    
    const ctx = canvas.getContext('2d');
    const defaultData = {
      labels: [],
      datasets: [{
        data: [],
        backgroundColor: ChartConfig.colors.primary,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.5)'
      }]
    };
    
    const defaultOptions = {
      ...ChartConfig.defaultOptions,
      cutout: '70%',
      animation: ChartConfig.animation
    };
    
    return new Chart(ctx, {
      type: 'doughnut',
      data: options.data || defaultData,
      options: { ...defaultOptions, ...options.chartOptions }
    });
  }
}

/**
 * Chart updater - handles reactive updates to charts based on state changes
 */
export class ChartUpdater {
  /**
   * Create a chart updater
   * @param {Chart} chartInstance - Chart.js instance
   */
  constructor(chartInstance) {
    this.chart = chartInstance;
    this.subscriptions = [];
  }
  
  /**
   * Subscribe to state changes
   * @param {string} eventType - Event type to subscribe to
   * @param {Function} dataTransformer - Function to transform state data for the chart
   * @returns {Function} Unsubscribe function
   */
  subscribeToState(eventType, dataTransformer) {
    const unsubscribe = store.subscribe(eventType, (data) => {
      const chartData = dataTransformer(data);
      this.updateData(chartData);
    });
    
    this.subscriptions.push(unsubscribe);
    return unsubscribe;
  }
  
  /**
   * Update chart data
   * @param {Object} newData - New data for the chart
   */
  updateData(newData) {
    if (!this.chart) return;
    
    // Update labels if provided
    if (newData.labels) {
      this.chart.data.labels = newData.labels;
    }
    
    // Update datasets if provided
    if (newData.datasets) {
      // Update each dataset
      newData.datasets.forEach((newDataset, i) => {
        // If dataset exists, update it
        if (this.chart.data.datasets[i]) {
          Object.keys(newDataset).forEach(key => {
            this.chart.data.datasets[i][key] = newDataset[key];
          });
        } else {
          // Otherwise add new dataset
          this.chart.data.datasets.push(newDataset);
        }
      });
      
      // Remove extra datasets if any
      if (this.chart.data.datasets.length > newData.datasets.length) {
        this.chart.data.datasets.splice(newData.datasets.length);
      }
    } else if (newData.data) {
      // Direct data update for single dataset charts
      this.chart.data.datasets[0].data = newData.data;
    }
    
    // Update chart
    this.chart.update();
  }
  
  /**
   * Clean up subscriptions
   */
  destroy() {
    this.subscriptions.forEach(unsubscribe => unsubscribe());
    this.subscriptions = [];
    
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }
}

/**
 * Common data transformers for different chart types
 */
export const DataTransformers = {
  /**
   * Transform transactions for a balance over time chart
   * @param {Array} transactions - Transactions array
   * @returns {Object} Chart data
   */
  balanceOverTime(transactions) {
    // Get current month and year
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    // Initialize daily balances
    const dailyBalances = Array(daysInMonth).fill(0);
    let runningBalance = 0;
    
    // Filter transactions for current month
    const currentMonthTransactions = transactions.filter(tx => {
      const txDate = new Date(tx.date);
      return txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
    });
    
    // Sort transactions by date
    currentMonthTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Calculate running balance for each day
    currentMonthTransactions.forEach(tx => {
      const txDate = new Date(tx.date);
      const day = txDate.getDate() - 1; // Array is 0-indexed
      const amount = parseFloat(tx.amount);
      
      if (!isNaN(amount)) {
        runningBalance += amount;
        
        // Update this day and all future days with the new balance
        for (let i = day; i < daysInMonth; i++) {
          dailyBalances[i] = runningBalance;
        }
      }
    });
    
    // Create labels for all days in the month
    const labels = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    
    return {
      labels,
      datasets: [{
        label: 'Balance (₹)',
        data: dailyBalances,
        fill: true,
        borderColor: ChartConfig.colors.balance,
        backgroundColor: ChartConfig.colors.backgroundColors.balance,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    };
  },
  
  /**
   * Transform transactions for a spending by category chart
   * @param {Array} transactions - Transactions array
   * @returns {Object} Chart data
   */
  spendingByCategory(transactions) {
    // Get expense transactions
    const expenses = transactions.filter(tx => 
      tx.type === 'expense' || parseFloat(tx.amount) < 0
    );
    
    // Group by category
    const categories = {};
    expenses.forEach(tx => {
      const category = tx.category || 'Other';
      const amount = Math.abs(parseFloat(tx.amount));
      
      if (!isNaN(amount)) {
        if (!categories[category]) {
          categories[category] = 0;
        }
        categories[category] += amount;
      }
    });
    
    // Convert to arrays for chart
    const labels = Object.keys(categories);
    const data = Object.values(categories);
    
    // Generate colors
    const backgroundColor = labels.map((_, i) => 
      ChartConfig.colors.primary[i % ChartConfig.colors.primary.length]
    );
    
    return {
      labels,
      datasets: [{
        label: 'Amount (₹)',
        data,
        backgroundColor,
        borderRadius: 4
      }]
    };
  },
  
  /**
   * Transform transactions for an income vs expenses chart
   * @param {Array} transactions - Transactions array
   * @returns {Object} Chart data
   */
  incomeVsExpenses(transactions) {
    // Group by month
    const monthlyData = {};
    
    transactions.forEach(tx => {
      const date = new Date(tx.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const amount = parseFloat(tx.amount);
      
      if (isNaN(amount)) return;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { income: 0, expenses: 0 };
      }
      
      if (tx.type === 'income' || amount > 0) {
        monthlyData[monthKey].income += Math.abs(amount);
      } else {
        monthlyData[monthKey].expenses += Math.abs(amount);
      }
    });
    
    // Sort months
    const sortedMonths = Object.keys(monthlyData).sort();
    
    // Get last 6 months
    const recentMonths = sortedMonths.slice(-6);
    
    // Format month labels
    const labels = recentMonths.map(month => {
      const [year, monthNum] = month.split('-');
      return new Date(parseInt(year), parseInt(monthNum) - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    });
    
    // Extract data
    const incomeData = recentMonths.map(month => monthlyData[month].income);
    const expenseData = recentMonths.map(month => monthlyData[month].expenses);
    
    return {
      labels,
      datasets: [
        {
          label: 'Income',
          data: incomeData,
          backgroundColor: ChartConfig.colors.income,
          borderRadius: 4
        },
        {
          label: 'Expenses',
          data: expenseData,
          backgroundColor: ChartConfig.colors.expense,
          borderRadius: 4
        }
      ]
    };
  },
  
  /**
   * Transform savings goals for a progress chart
   * @param {Array} savingsGoals - Savings goals array
   * @param {Array} transactions - Transactions array (for calculating contributions)
   * @returns {Object} Chart data
   */
  savingsGoalProgress(savingsGoals, transactions) {
    // Calculate progress for each goal
    const goalData = savingsGoals.map(goal => {
      // Find contributions to this goal
      const contributions = transactions
        .filter(tx => tx.savingsGoalId === goal.id || tx.savingsGoalId === goal._id)
        .reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
        
      const targetAmount = parseFloat(goal.targetAmount);
      const progress = (contributions / targetAmount) * 100;
      
      return {
        name: goal.name,
        current: contributions,
        target: targetAmount,
        progress: Math.min(progress, 100)
      };
    });
    
    // Sort by progress (descending)
    goalData.sort((a, b) => b.progress - a.progress);
    
    // Extract data for chart
    const labels = goalData.map(goal => goal.name);
    const currentData = goalData.map(goal => goal.current);
    const remainingData = goalData.map(goal => Math.max(goal.target - goal.current, 0));
    
    return {
      labels,
      datasets: [
        {
          label: 'Current Amount',
          data: currentData,
          backgroundColor: ChartConfig.colors.income,
          borderRadius: 4
        },
        {
          label: 'Remaining',
          data: remainingData,
          backgroundColor: ChartConfig.colors.backgroundColors.income,
          borderRadius: 4
        }
      ]
    };
  },
  
  /**
   * Transform budgets for a budget progress chart
   * @param {Array} budgets - Budgets array
   * @param {Array} transactions - Transactions array (for calculating spending)
   * @returns {Object} Chart data
   */
  budgetProgress(budgets, transactions) {
    // Get current month and year
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    // Calculate spending for each budget
    const budgetData = budgets.map(budget => {
      // Find expenses in this category for current month
      const expenses = transactions
        .filter(tx => {
          const txDate = new Date(tx.date);
          return txDate.getMonth() === currentMonth && 
                 txDate.getFullYear() === currentYear &&
                 tx.type === 'expense' && 
                 tx.category === budget.category;
        })
        .reduce((sum, tx) => sum + Math.abs(parseFloat(tx.amount)), 0);
        
      const limit = parseFloat(budget.limit);
      const progress = (expenses / limit) * 100;
      
      return {
        category: budget.category,
        spent: expenses,
        limit,
        progress: Math.min(progress, 100),
        isOverBudget: expenses > limit
      };
    });
    
    // Sort by progress (descending)
    budgetData.sort((a, b) => b.progress - a.progress);
    
    // Extract data for chart
    const labels = budgetData.map(budget => budget.category);
    const spentData = budgetData.map(budget => budget.spent);
    const remainingData = budgetData.map(budget => Math.max(budget.limit - budget.spent, 0));
    
    return {
      labels,
      datasets: [
        {
          label: 'Spent',
          data: spentData,
          backgroundColor: budgetData.map(budget => 
            budget.isOverBudget ? ChartConfig.colors.expense : ChartConfig.colors.primary[0]
          ),
          borderRadius: 4
        },
        {
          label: 'Remaining',
          data: remainingData,
          backgroundColor: ChartConfig.colors.backgroundColors.primary,
          borderRadius: 4
        }
      ]
    };
  }
};

/**
 * Chart manager - manages multiple charts on a page
 */
export class ChartManager {
  constructor() {
    this.charts = new Map();
    this.updaters = new Map();
  }
  
  /**
   * Initialize a line chart
   * @param {string} canvasId - Canvas element ID
   * @param {Object} options - Chart options
   * @returns {Chart} Chart instance
   */
  initLineChart(canvasId, options = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    
    // Destroy existing chart if it exists
    this.destroyChart(canvasId);
    
    // Create new chart
    const chart = ChartFactory.createLineChart(canvas, options);
    this.charts.set(canvasId, chart);
    
    const updater = new ChartUpdater(chart);
    this.updaters.set(canvasId, updater);
    
    return chart;
  }
  
  /**
   * Initialize a bar chart
   * @param {string} canvasId - Canvas element ID
   * @param {Object} options - Chart options
   * @returns {Chart} Chart instance
   */
  initBarChart(canvasId, options = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    
    // Destroy existing chart if it exists
    this.destroyChart(canvasId);
    
    // Create new chart
    const chart = ChartFactory.createBarChart(canvas, options);
    this.charts.set(canvasId, chart);
    
    const updater = new ChartUpdater(chart);
    this.updaters.set(canvasId, updater);
    
    return chart;
  }
  
  /**
   * Initialize a doughnut chart
   * @param {string} canvasId - Canvas element ID
   * @param {Object} options - Chart options
   * @returns {Chart} Chart instance
   */
  initDoughnutChart(canvasId, options = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    
    // Destroy existing chart if it exists
    this.destroyChart(canvasId);
    
    // Create new chart
    const chart = ChartFactory.createDoughnutChart(canvas, options);
    this.charts.set(canvasId, chart);
    
    const updater = new ChartUpdater(chart);
    this.updaters.set(canvasId, updater);
    
    return chart;
  }
  
  /**
   * Get a chart instance by ID
   * @param {string} chartId - Chart ID
   * @returns {Chart} Chart instance
   */
  getChart(chartId) {
    return this.charts.get(chartId);
  }
  
  /**
   * Get a chart updater by ID
   * @param {string} chartId - Chart ID
   * @returns {ChartUpdater} Chart updater
   */
  getUpdater(chartId) {
    return this.updaters.get(chartId);
  }
  
  /**
   * Update a chart with new data
   * @param {string} chartId - Chart ID
   * @param {Object} newData - New data for the chart
   */
  updateChart(chartId, newData) {
    const updater = this.updaters.get(chartId);
    if (updater) {
      updater.updateData(newData);
    }
  }
  
  /**
   * Subscribe a chart to state changes
   * @param {string} chartId - Chart ID
   * @param {string} eventType - Event type to subscribe to
   * @param {Function} dataTransformer - Function to transform state data for the chart
   */
  subscribeChart(chartId, eventType, dataTransformer) {
    const updater = this.updaters.get(chartId);
    if (updater) {
      updater.subscribeToState(eventType, dataTransformer);
    }
  }
  
  /**
   * Destroy a specific chart by ID
   * @param {string} chartId - Chart ID
   */
  destroyChart(chartId) {
    // Get the chart instance
    const chart = this.charts.get(chartId);
    if (chart) {
      // Destroy the chart
      chart.destroy();
      this.charts.delete(chartId);
    }
    
    // Get the updater instance
    const updater = this.updaters.get(chartId);
    if (updater) {
      // Destroy the updater
      updater.destroy();
      this.updaters.delete(chartId);
    }
  }
  
  /**
   * Clean up all charts
   */
  destroyAll() {
    this.charts.forEach(chart => {
      if (chart) {
        chart.destroy();
      }
    });
    
    this.charts.clear();
    
    this.updaters.forEach(updater => {
      if (updater) {
        updater.destroy();
      }
    });
    
    this.updaters.clear();
  }
}

// Export a singleton instance for global use
export const chartManager = new ChartManager();

// For backwards compatibility with non-module scripts
window.FinTrackCharts = {
  ChartConfig,
  ChartFactory,
  ChartUpdater,
  DataTransformers,
  chartManager
};
