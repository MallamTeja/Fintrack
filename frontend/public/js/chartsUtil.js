// chartsUtil.js - Utility for reactive charts that update in real-time

/**
 * Reactive Charts Utility
 * Handles real-time updates for financial charts used in the insights page
 */
class ChartsUtility {
  constructor() {
    this.expenseChart = null;
    this.trendChart = null;
    this.transactionService = window.transactionService;
    this.websocketService = window.websocketService;
    this.currentDateRange = 'monthly';
    this.chartColors = {
      light: {
        gridColor: '#e2e8f0',
        textColor: '#1a1a1a'
      },
      dark: {
        gridColor: '#334155',
        textColor: '#f8fafc'
      }
    };
  }

  /**
   * Initialize charts and set up real-time updates
   */
  initialize() {
    // Initialize expense category chart
    const expenseCtx = document.getElementById('expenseChart')?.getContext('2d');
    if (expenseCtx) {
      this.expenseChart = this.createExpenseChart(expenseCtx);
    }

    // Initialize income vs expense trend chart
    const trendCtx = document.getElementById('trendChart')?.getContext('2d');
    if (trendCtx) {
      this.trendChart = this.createTrendChart(trendCtx);
    }

    // Set up real-time updates via transaction service
    if (this.transactionService) {
      this.transactionService.subscribe(transactions => {
        this.updateChartsWithData(transactions);
        this.updateTopSpendingCategories(transactions);
      });
    }

    // Set up real-time updates via websocket
    if (this.websocketService) {
      this.websocketService.onTransactionUpdate((data) => {
        console.log('WebSocket update received for charts:', data);
        const transactions = this.transactionService.getAllTransactions();
        this.updateChartsWithData(transactions);
      });
    }

    // Initial data load
    this.loadInitialData();

    // Set up date range filter listener
    this.setupDateFilterListeners();
  }

  /**
   * Create the expense categories pie chart
   */
  createExpenseChart(ctx) {
    return new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: [],
        datasets: [{
          data: [],
          backgroundColor: [
            '#3b82f6',
            '#ef4444',
            '#10b981',
            '#f59e0b',
            '#8b5cf6',
            '#6366f1',
            '#ec4899',
            '#14b8a6',
            '#f97316',
            '#a855f7'
          ],
          borderWidth: 1,
          hoverOffset: 10
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              font: {
                size: 12
              },
              padding: 15
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = context.label || '';
                const value = context.parsed || 0;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                return `${label}: ₹${value.toLocaleString()} (${percentage}%)`;
              }
            }
          },
          animation: {
            animateScale: true,
            animateRotate: true
          }
        }
      }
    });
  }

  /**
   * Create the income vs expense trend chart
   */
  createTrendChart(ctx) {
    return new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Income',
            data: [],
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6
          },
          {
            label: 'Expenses',
            data: [],
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            position: 'top',
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = context.dataset.label || '';
                const value = context.parsed.y || 0;
                return `${label}: ₹${value.toLocaleString()}`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => `₹${value.toLocaleString()}`
            },
            grid: {
              color: this.getThemeColors().gridColor
            }
          },
          x: {
            grid: {
              color: this.getThemeColors().gridColor
            }
          }
        },
        animations: {
          radius: {
            duration: 400,
            easing: 'linear'
          }
        }
      }
    });
  }

  /**
   * Update charts with transaction data
   */
  updateChartsWithData(transactions) {
    if (!transactions || transactions.length === 0) {
      this.loadSampleData();
      return;
    }

    try {
      // Add visual feedback for update
      this.addUpdateFeedback();

      // Filter transactions by date range
      const filteredTransactions = this.filterTransactionsByDateRange(transactions, this.currentDateRange);

      // Update expense categories chart
      this.updateExpenseCategoriesChart(filteredTransactions);

      // Update income vs expense trend chart
      this.updateTrendChart(filteredTransactions);

    } catch (error) {
      console.error('Error updating charts:', error);
    }
  }

  /**
   * Filter transactions based on the selected date range
   */
  filterTransactionsByDateRange(transactions, range) {
    const now = new Date();
    const startDate = new Date();
    
    switch(range) {
      case 'weekly':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'monthly':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'quarterly':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case 'custom':
        const customStart = document.getElementById('customStart');
        const customEnd = document.getElementById('customEnd');
        if (customStart && customStart.value && customEnd && customEnd.value) {
          return transactions.filter(tx => {
            const txDate = new Date(tx.date);
            return txDate >= new Date(customStart.value) && txDate <= new Date(customEnd.value);
          });
        }
        break;
      default:
        startDate.setMonth(now.getMonth() - 1); // Default to monthly
    }
    
    return transactions.filter(tx => new Date(tx.date) >= startDate);
  }

  /**
   * Update the expense categories chart
   */
  updateExpenseCategoriesChart(transactions) {
    if (!this.expenseChart) return;
    
    // Get expense transactions only
    const expenseTransactions = transactions.filter(tx => tx.type === 'expense');
    
    // Group by category
    const categoryData = {};
    expenseTransactions.forEach(tx => {
      const category = tx.category || 'Other';
      const amount = parseFloat(tx.amount) || 0;
      if (!categoryData[category]) {
        categoryData[category] = 0;
      }
      categoryData[category] += amount;
    });
    
    // Sort categories by amount
    const sortedCategories = Object.entries(categoryData)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7); // Get top 7 categories
    
    // Prepare chart data
    const labels = sortedCategories.map(([category]) => category);
    const values = sortedCategories.map(([_, amount]) => amount);
    
    // Update chart
    this.expenseChart.data.labels = labels;
    this.expenseChart.data.datasets[0].data = values;
    
    // Apply animations
    this.expenseChart.options.animation = {
      duration: 800,
      easing: 'easeOutQuart'
    };
    
    this.expenseChart.update();
  }

  /**
   * Update the income vs expense trend chart
   */
  updateTrendChart(transactions) {
    if (!this.trendChart) return;
    
    const periodData = this.getPeriodData(transactions, this.currentDateRange);
    
    // Update chart data
    this.trendChart.data.labels = periodData.labels;
    this.trendChart.data.datasets[0].data = periodData.income;
    this.trendChart.data.datasets[1].data = periodData.expenses;
    
    // Apply animations
    this.trendChart.options.animation = {
      duration: 800,
      easing: 'easeOutQuart'
    };
    
    this.trendChart.update();
  }

  /**
   * Get period data (weekly, monthly, quarterly) from transactions
   */
  getPeriodData(transactions, range) {
    const periodFormat = {
      weekly: { count: 7, format: 'ddd' }, // Last 7 days
      monthly: { count: 6, format: 'MMM DD' }, // Last 6 time periods in month
      quarterly: { count: 3, format: 'MMM' }  // Last 3 months
    };
    
    const format = periodFormat[range] || periodFormat.monthly;
    const labels = [];
    const income = Array(format.count).fill(0);
    const expenses = Array(format.count).fill(0);
    
    // Generate labels based on range
    const today = new Date();
    
    if (range === 'weekly') {
      // For weekly, show last 7 days
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        labels.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
      }
    } else if (range === 'monthly') {
      // For monthly, divide the month into 6 periods
      const daysInPeriod = Math.ceil(30 / 6);
      for (let i = 5; i >= 0; i--) {
        const endDate = new Date(today);
        endDate.setDate(today.getDate() - (i * daysInPeriod));
        const startDate = new Date(endDate);
        startDate.setDate(endDate.getDate() - daysInPeriod + 1);
        
        const startFormatted = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const endFormatted = endDate.toLocaleDateString('en-US', { day: 'numeric' });
        labels.push(`${startFormatted}-${endFormatted}`);
      }
    } else if (range === 'quarterly') {
      // For quarterly, show last 3 months
      for (let i = 2; i >= 0; i--) {
        const date = new Date(today);
        date.setMonth(today.getMonth() - i);
        labels.push(date.toLocaleDateString('en-US', { month: 'short' }));
      }
    }
    
    // Process transactions into periods
    transactions.forEach(tx => {
      const txDate = new Date(tx.date);
      const amount = parseFloat(tx.amount) || 0;
      let periodIndex = -1;
      
      if (range === 'weekly') {
        // Calculate days ago (0-6)
        const daysAgo = Math.floor((today - txDate) / (1000 * 60 * 60 * 24));
        if (daysAgo >= 0 && daysAgo < 7) {
          periodIndex = 6 - daysAgo;
        }
      } else if (range === 'monthly') {
        const daysAgo = Math.floor((today - txDate) / (1000 * 60 * 60 * 24));
        const daysInPeriod = Math.ceil(30 / 6);
        const periodAgo = Math.floor(daysAgo / daysInPeriod);
        if (periodAgo >= 0 && periodAgo < 6) {
          periodIndex = 5 - periodAgo;
        }
      } else if (range === 'quarterly') {
        const monthsAgo = (today.getFullYear() - txDate.getFullYear()) * 12 + today.getMonth() - txDate.getMonth();
        if (monthsAgo >= 0 && monthsAgo < 3) {
          periodIndex = 2 - monthsAgo;
        }
      }
      
      if (periodIndex >= 0) {
        if (tx.type === 'income') {
          income[periodIndex] += amount;
        } else {
          expenses[periodIndex] += amount;
        }
      }
    });
    
    return { labels, income, expenses };
  }

  /**
   * Get theme colors based on current theme
   */
  getThemeColors() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return isDark ? this.chartColors.dark : this.chartColors.light;
  }

  /**
   * Update theme-dependent chart properties
   */
  updateTheme() {
    const colors = this.getThemeColors();
    
    if (this.trendChart) {
      this.trendChart.options.scales.x.grid.color = colors.gridColor;
      this.trendChart.options.scales.y.grid.color = colors.gridColor;
      this.trendChart.options.plugins.legend.labels.color = colors.textColor;
      this.trendChart.update();
    }
    
    if (this.expenseChart) {
      this.expenseChart.options.plugins.legend.labels.color = colors.textColor;
      this.expenseChart.update();
    }
  }

  /**
   * Add visual feedback when charts update
   */
  addUpdateFeedback() {
    const chartsContainer = document.getElementById('chartsContainer');
    if (chartsContainer) {
      chartsContainer.classList.add('pulse-animation');
      setTimeout(() => {
        chartsContainer.classList.remove('pulse-animation');
      }, 700);
    }
  }

  /**
   * Update top spending categories section
   */
  updateTopSpendingCategories(transactions) {
    const topSpendingElement = document.querySelector('.card h3:contains("Top Spending Categories")').closest('.card');
    if (!topSpendingElement) return;
    
    // Get expense transactions only
    const expenseTransactions = transactions.filter(tx => tx.type === 'expense');
    
    // Group by category
    const categoryData = {};
    let totalExpenses = 0;
    
    expenseTransactions.forEach(tx => {
      const category = tx.category || 'Other';
      const amount = parseFloat(tx.amount) || 0;
      totalExpenses += amount;
      
      if (!categoryData[category]) {
        categoryData[category] = 0;
      }
      categoryData[category] += amount;
    });
    
    // Sort categories by amount
    const sortedCategories = Object.entries(categoryData)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3); // Get top 3 categories
    
    // Generate HTML for progress bars
    let progressBarsHtml = '';
    
    sortedCategories.forEach(([category, amount]) => {
      const percentage = totalExpenses > 0 ? Math.round((amount / totalExpenses) * 100) : 0;
      progressBarsHtml += `
        <div class="flex items-center">
          <div class="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
            <div class="bg-blue-600 h-2.5 rounded-full" style="width: ${percentage}%"></div>
          </div>
          <span class="ml-4 min-w-[100px]">${category} (${percentage}%)</span>
        </div>
      `;
    });
    
    // If no data, show default message
    if (sortedCategories.length === 0) {
      progressBarsHtml = '<p class="text-center text-gray-500">No expense data available</p>';
    }
    
    // Update the DOM
    const progressContainer = topSpendingElement.querySelector('.space-y-4');
    if (progressContainer) {
      progressContainer.innerHTML = progressBarsHtml;
      
      // Add animation
      progressContainer.querySelectorAll('.bg-blue-600').forEach(bar => {
        bar.style.transition = 'width 1s ease-out';
      });
    }
  }

  /**
   * Load initial chart data
   */
  loadInitialData() {
    const transactions = this.transactionService?.getAllTransactions();
    
    if (transactions && transactions.length > 0) {
      this.updateChartsWithData(transactions);
    } else {
      this.loadSampleData();
    }
  }

  /**
   * Load sample chart data when no transactions are available
   */
  loadSampleData() {
    const sampleData = {
      weekly: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        income: [8000, 7500, 9000, 8500, 12000, 6500, 7000],
        expenses: [4500, 6000, 5800, 7300, 9200, 5500, 3800],
        categories: ['Food', 'Rent', 'Transport', 'Entertainment', 'Utilities'],
        categoryValues: [15000, 12000, 8000, 4500, 3200]
      },
      monthly: {
        labels: ['May 1-5', 'May 6-10', 'May 11-15', 'May 16-20', 'May 21-25', 'May 26-31'],
        income: [15000, 16000, 14500, 15800, 17200, 18300],
        expenses: [12000, 13500, 11800, 14200, 15300, 14100],
        categories: ['Food', 'Rent', 'Transport', 'Entertainment', 'Utilities', 'Shopping', 'Healthcare'],
        categoryValues: [24500, 18000, 12000, 8500, 7200, 6300, 5100]
      },
      quarterly: {
        labels: ['Mar', 'Apr', 'May'],
        income: [45000, 48000, 52000],
        expenses: [38000, 41000, 44500],
        categories: ['Food', 'Rent', 'Transport', 'Entertainment', 'Utilities'],
        categoryValues: [45000, 36000, 24000, 18500, 15000]
      }
    };

    const data = sampleData[this.currentDateRange] || sampleData.monthly;

    // Update expense chart with sample data
    if (this.expenseChart) {
      this.expenseChart.data.labels = data.categories;
      this.expenseChart.data.datasets[0].data = data.categoryValues;
      
      // Animate the chart update
      this.expenseChart.options.animation = {
        duration: 1000,
        easing: 'easeOutQuart'
      };
      
      this.expenseChart.update();
    }

    // Update trend chart with sample data
    if (this.trendChart) {
      this.trendChart.data.labels = data.labels;
      this.trendChart.data.datasets[0].data = data.income;
      this.trendChart.data.datasets[1].data = data.expenses;
      
      // Animate the chart update
      this.trendChart.options.animation = {
        duration: 1000,
        easing: 'easeOutQuart'
      };
      
      this.trendChart.update();
    }
  }

  /**
   * Set up event listeners for the date filter
   */
  setupDateFilterListeners() {
    const dateFilter = document.getElementById('dateFilter');
    const customDateInputs = document.getElementById('customDateInputs');
    
    if (dateFilter) {
      dateFilter.addEventListener('change', (e) => {
        this.currentDateRange = e.target.value;
        
        // Show/hide custom date inputs
        if (customDateInputs) {
          customDateInputs.style.display = this.currentDateRange === 'custom' ? 'flex' : 'none';
        }
        
        // Update charts based on new date range
        const transactions = this.transactionService?.getAllTransactions() || [];
        this.updateChartsWithData(transactions);
      });
    }
    
    // Set up custom date input listeners
    const customStart = document.getElementById('customStart');
    const customEnd = document.getElementById('customEnd');
    
    if (customStart && customEnd) {
      const updateOnCustomDate = () => {
        if (customStart.value && customEnd.value) {
          const transactions = this.transactionService?.getAllTransactions() || [];
          this.updateChartsWithData(transactions);
        }
      };
      
      customStart.addEventListener('change', updateOnCustomDate);
      customEnd.addEventListener('change', updateOnCustomDate);
    }
    
    // Theme toggle listener
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        this.toggleTheme();
      });
    }
  }

  /**
   * Toggle between light and dark theme
   */
  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);

    // Persist theme preference in localStorage
    localStorage.setItem('theme', newTheme);

    // Update charts colors
    this.updateTheme();
  }
  }
}

// Initialize when document is loaded
document.addEventListener('DOMContentLoaded', () => {
  const chartsUtil = new ChartsUtility();
  chartsUtil.initialize();
  
  // Make the utility globally accessible
  window.chartsUtil = chartsUtil;
  
  // Add CSS for chart update animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes pulse-animation {
      0% { transform: scale(1); }
      50% { transform: scale(1.02); }
      100% { transform: scale(1); }
    }
    
    .pulse-animation {
      animation: pulse-animation 0.7s ease-in-out;
    }
  `;
  document.head.appendChild(style);
});