import { store } from '../state/index.js';

class ExpensesLimits {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.noLimitsMessage = document.getElementById('noLimitsMessage');
    this.limitModal = document.getElementById('limitModal');
    this.deleteModal = document.getElementById('deleteModal');
    this.limitForm = document.getElementById('limitForm');
    this.cancelButton = document.getElementById('cancelButton');
    this.limitIdField = document.getElementById('limitId');
    this.categorySelect = document.getElementById('category');
    this.otherCategoryField = document.getElementById('otherCategoryField');
    this.fromDateField = document.getElementById('fromDate');
    this.toDateField = document.getElementById('toDate');
    this.currentBudgetId = null;

    // Set default dates (current month)
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    this.fromDateField.valueAsDate = firstDay;
    this.toDateField.valueAsDate = lastDay;

    this.init();
  }

  init() {
    // Subscribe to budget updates
    store.subscribe('budgets:updated', this.render.bind(this));
    // Fetch budgets
    store.dispatch('budgets:fetch');

    // Form handlers
    this.limitForm.addEventListener('submit', this.handleFormSubmit.bind(this));
    this.cancelButton.addEventListener('click', () => this.hideModal());
    this.categorySelect.addEventListener('change', this.handleCategoryChange.bind(this));

    // Add Limit button
    const addBtn = document.getElementById('addLimitButton');
    if (addBtn) addBtn.addEventListener('click', () => this.openAddModal());

    // Close modal buttons
    document.querySelectorAll('.close-button').forEach(btn => {
      btn.addEventListener('click', () => {
        this.hideModal();
        this.hideDeleteModal();
      });
    });

    // Delete confirmation
    document.querySelector('.delete-button').addEventListener('click', () => {
      if (this.currentBudgetId) {
        store.dispatch('budget:delete', this.currentBudgetId);
        this.hideDeleteModal();
      }
    });

    // Cancel delete
    document.querySelector('#deleteModal button:not(.delete-button)').addEventListener('click', () => {
      this.hideDeleteModal();
    });
  }

  render(budgets) {
    this.container.innerHTML = '';
    if (!budgets || budgets.length === 0) {
      this.noLimitsMessage.classList.remove('hidden');
      return;
    }
    this.noLimitsMessage.classList.add('hidden');
    budgets.forEach(b => this.createCard(b));
  }

  createCard(budget) {
    const card = document.createElement('div');
    card.className = 'limit-card scale-in';
    const limit = budget.limit;
    const spent = budget.current_spending || 0;
    const perc = Math.min((spent / limit) * 100, 100);
    
    // Determine status based on percentage
    let statusClass = 'safe';
    if (perc >= 90) {
      statusClass = 'danger';
    } else if (perc >= 75) {
      statusClass = 'warning';
    }
    
    // Format currency
    const formattedLimit = this.formatCurrency(limit);
    const formattedSpent = this.formatCurrency(spent);
    const remaining = Math.max(limit - spent, 0);
    const formattedRemaining = this.formatCurrency(remaining);
    
    // Get category icon
    const categoryIcon = this.getCategoryIcon(budget.category);
    
    card.innerHTML = `
      <div class="status-indicator ${statusClass}"></div>
      <h4>
        <span class="category-icon ${budget.category.toLowerCase()}">${categoryIcon}</span>
        ${this.formatCategory(budget.category)}
      </h4>
      
      <div class="limit-details">
        <div class="limit-info">
          <p>Limit Amount</p>
          <div class="amount-display">₹${formattedLimit}</div>
        </div>
      </div>
      
      <div class="progress-container">
        <div class="progress-stats">
          <span>Spent: ₹${formattedSpent}</span>
          <span class="progress-percentage">${Math.round(perc)}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill ${statusClass}" style="width:${perc}%;"></div>
        </div>
        <div class="progress-stats">
          <span>Remaining: ₹${formattedRemaining}</span>
        </div>
      </div>
      
      <div class="card-actions">
        <button class="edit-btn" data-id="${budget._id}">
          <svg class="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Edit
        </button>
        <button class="delete-btn" data-id="${budget._id}">
          <svg class="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete
        </button>
      </div>
    `;
    
    card.querySelector('.edit-btn').addEventListener('click', () => this.openEditModal(budget));
    card.querySelector('.delete-btn').addEventListener('click', () => this.openDeleteModal(budget));
    
    this.container.appendChild(card);
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN').format(amount);
  }

  formatCategory(cat) {
    return cat.charAt(0).toUpperCase() + cat.slice(1);
  }
  
  getCategoryIcon(category) {
    const icons = {
      food: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>',
      travelling: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>',
      bills: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>',
      entertainment: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"/></svg>',
      shopping: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>',
      health: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>',
      education: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>',
      other: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z"/></svg>'
    };
    
    return icons[category.toLowerCase()] || icons.other;
  }

  handleCategoryChange(e) {
    if (e.target.value === 'other') this.otherCategoryField.classList.remove('hidden');
    else this.otherCategoryField.classList.add('hidden');
  }

  openAddModal() {
    this.limitForm.reset();
    this.limitIdField.value = '';
    document.getElementById('modalTitle').textContent = 'Add New Expense Limit';
    this.otherCategoryField.classList.add('hidden');
    
    // Set default dates (current month)
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    this.fromDateField.valueAsDate = firstDay;
    this.toDateField.valueAsDate = lastDay;
    
    this.limitModal.classList.remove('hidden');
    document.getElementById('amount').focus();
  }

  openEditModal(budget) {
    this.limitForm.reset();
    this.limitIdField.value = budget._id;
    document.getElementById('modalTitle').textContent = 'Edit Expense Limit';

    if (this.categorySelect.querySelector(`option[value="${budget.category}"]`)) {
      this.categorySelect.value = budget.category;
      this.otherCategoryField.classList.add('hidden');
    } else {
      this.categorySelect.value = 'other';
      this.otherCategoryField.classList.remove('hidden');
      document.getElementById('customCategory').value = budget.category;
    }
    
    document.getElementById('amount').value = budget.limit;
    
    // Set dates if available, otherwise use current month
    if (budget.from_date) {
      this.fromDateField.value = new Date(budget.from_date).toISOString().split('T')[0];
    }
    
    if (budget.to_date) {
      this.toDateField.value = new Date(budget.to_date).toISOString().split('T')[0];
    }
    
    if (budget.description) {
      document.getElementById('description').value = budget.description;
    }
    
    this.limitModal.classList.remove('hidden');
    document.getElementById('amount').focus();
  }
  
  openDeleteModal(budget) {
    this.currentBudgetId = budget._id;
    document.getElementById('deleteModalTitle').textContent = `Delete ${this.formatCategory(budget.category)} Expense Limit`;
    this.deleteModal.classList.remove('hidden');
  }

  hideModal() {
    this.limitModal.classList.add('hidden');
  }
  
  hideDeleteModal() {
    this.deleteModal.classList.add('hidden');
  }

  handleFormSubmit(e) {
    e.preventDefault();
    let category = this.categorySelect.value;
    if (category === 'other') category = document.getElementById('customCategory').value.trim();
    const limitVal = parseFloat(document.getElementById('amount').value);
    const fromDate = this.fromDateField.value;
    const toDate = this.toDateField.value;
    const description = document.getElementById('description').value.trim();
    
    if (!category || isNaN(limitVal) || limitVal <= 0) {
      alert('Please provide a valid category and limit amount.');
      return;
    }
    
    if (!fromDate || !toDate) {
      alert('Please provide valid date range.');
      return;
    }
    
    const budgetData = {
      category,
      limit: limitVal,
      from_date: fromDate,
      to_date: toDate,
      description
    };
    
    const id = this.limitIdField.value;
    if (id) {
      store.dispatch('budget:update', { id, data: budgetData });
    } else {
      store.dispatch('budget:add', budgetData);
    }
    
    this.hideModal();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new ExpensesLimits('limitsContainer');
});
