/**
 * Settings Page JavaScript
 * Handles all button functionalities and form submissions on the settings page
 */

 // Toast alert
const toast = document.getElementById('toast');
let toastTimeout;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// Tab switching
const tabs = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => {
      t.classList.remove('bg-blue-500', 'text-white');
      t.classList.add('bg-gray-300', 'text-gray-700');
    });
    tab.classList.add('bg-blue-500', 'text-white');
    tab.classList.remove('bg-gray-300', 'text-gray-700');

    const target = tab.getAttribute('data-tab');
    tabContents.forEach(tc => {
      if (tc.id === target) {
        tc.classList.remove('hidden');
      } else {
        tc.classList.add('hidden');
      }
    });
  });
});

// Reset Data Modal
const resetModal = document.getElementById('resetModal');
const openResetModalBtn = document.getElementById('openResetModal');
const cancelResetBtn = document.getElementById('cancelReset');
const confirmResetBtn = document.getElementById('confirmReset');

openResetModalBtn.addEventListener('click', () => {
  resetModal.classList.add('active');
});

cancelResetBtn.addEventListener('click', () => {
  resetModal.classList.remove('active');
});

confirmResetBtn.addEventListener('click', () => {
  resetModal.classList.remove('active');
  // Implement data reset logic here
  // For example, clear localStorage or call backend API to reset data
  localStorage.clear();
  showToast('All data has been reset.');
});

// Export & Backup form submission
const exportForm = document.getElementById('exportForm');
exportForm.addEventListener('submit', (e) => {
  e.preventDefault();
  // Implement export and backup logic here
  // For example, export data from localStorage or call backend API
  showToast('Data export/backup completed.');
  document.getElementById('lastBackupTime').textContent = new Date().toLocaleString();
});

// Appearance form submission
const appearanceForm = document.getElementById('appearanceForm');
appearanceForm.addEventListener('submit', (e) => {
  e.preventDefault();
  // Save theme settings to localStorage
  const formData = new FormData(appearanceForm);
  const theme = formData.get('theme');
  localStorage.setItem('theme', theme);
  showToast('Appearance settings saved.');
});

// Notifications form submission
const notificationsForm = document.getElementById('notificationsForm');
notificationsForm.addEventListener('submit', (e) => {
  e.preventDefault();
  // Save notification preferences to localStorage
  const formData = new FormData(notificationsForm);
  const expenseAlerts = formData.get('expenseAlerts') === 'on';
  const savingsReminders = formData.get('savingsReminders') === 'on';
  const summaryReports = formData.get('summaryReports') === 'on';
  const notificationPrefs = {
    expenseAlerts,
    savingsReminders,
    summaryReports
  };
  localStorage.setItem('notificationPrefs', JSON.stringify(notificationPrefs));
  showToast('Notification preferences saved.');
});

// Manage Categories
const incomeCategoriesList = document.getElementById('incomeCategories');
const expenseCategoriesList = document.getElementById('expenseCategories');
const newIncomeCategoryInput = document.getElementById('newIncomeCategory');
const newExpenseCategoryInput = document.getElementById('newExpenseCategory');
const addIncomeCategoryBtn = document.getElementById('addIncomeCategory');
const addExpenseCategoryBtn = document.getElementById('addExpenseCategory');

// Helper to create category list item
function createCategoryItem(name, type) {
  const li = document.createElement('li');
  li.className = 'flex justify-between items-center border border-gray-300 rounded p-2';
  const span = document.createElement('span');
  span.textContent = name;
  const div = document.createElement('div');
  div.className = 'flex gap-2';

  const editBtn = document.createElement('button');
  editBtn.className = 'edit-btn text-blue-500 hover:underline';
  editBtn.textContent = 'Edit';
  editBtn.dataset.type = type;
  editBtn.dataset.name = name;

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'delete-btn text-red-500 hover:underline';
  deleteBtn.textContent = 'Delete';
  deleteBtn.dataset.type = type;
  deleteBtn.dataset.name = name;

  div.appendChild(editBtn);
  div.appendChild(deleteBtn);
  li.appendChild(span);
  li.appendChild(div);
  return li;
}

// Add Income Category
addIncomeCategoryBtn.addEventListener('click', () => {
  const newCat = newIncomeCategoryInput.value.trim();
  if (!newCat) {
    alert('Please enter a category name.');
    return;
  }
  // Check duplicates
  const existing = Array.from(incomeCategoriesList.children).some(li => li.firstChild.textContent.toLowerCase() === newCat.toLowerCase());
  if (existing) {
    alert('Category already exists.');
    return;
  }
  incomeCategoriesList.appendChild(createCategoryItem(newCat, 'income'));
  newIncomeCategoryInput.value = '';
  showToast('New income category added.');
  saveCategories();
});

// Add Expense Category
addExpenseCategoryBtn.addEventListener('click', () => {
  const newCat = newExpenseCategoryInput.value.trim();
  if (!newCat) {
    alert('Please enter a category name.');
    return;
  }
  // Check duplicates
  const existing = Array.from(expenseCategoriesList.children).some(li => li.firstChild.textContent.toLowerCase() === newCat.toLowerCase());
  if (existing) {
    alert('Category already exists.');
    return;
  }
  expenseCategoriesList.appendChild(createCategoryItem(newCat, 'expense'));
  newExpenseCategoryInput.value = '';
  showToast('New expense category added.');
  saveCategories();
});

// Edit and Delete buttons event delegation
document.getElementById('categories').addEventListener('click', (e) => {
  if (e.target.classList.contains('edit-btn')) {
    const type = e.target.dataset.type;
    const oldName = e.target.dataset.name;
    const newName = prompt('Rename category:', oldName);
    if (newName && newName.trim() !== '' && newName !== oldName) {
      // Check duplicates
      const list = type === 'income' ? incomeCategoriesList : expenseCategoriesList;
      const duplicate = Array.from(list.children).some(li => li.firstChild.textContent.toLowerCase() === newName.toLowerCase());
      if (duplicate) {
        alert('Category name already exists.');
        return;
      }
      e.target.dataset.name = newName;
      e.target.parentElement.previousElementSibling.textContent = newName;
      showToast('Category renamed.');
      saveCategories();
    }
  } else if (e.target.classList.contains('delete-btn')) {
    const type = e.target.dataset.type;
    const name = e.target.dataset.name;
    openDeleteCategoryModal(type, name);
  }
});

// Delete Category Modal
const deleteCategoryModal = document.getElementById('deleteCategoryModal');
const categoryToDeleteSpan = document.getElementById('categoryToDelete');
const categoryDeleteWarning = document.getElementById('categoryDeleteWarning');
const cancelDeleteCategoryBtn = document.getElementById('cancelDeleteCategory');
const confirmDeleteCategoryBtn = document.getElementById('confirmDeleteCategory');

let categoryToDelete = null;
let categoryTypeToDelete = null;

function openDeleteCategoryModal(type, name) {
  categoryToDelete = name;
  categoryTypeToDelete = type;
  categoryToDeleteSpan.textContent = name;
  categoryDeleteWarning.classList.add('hidden');
  // TODO: Check if category is used in transactions and show warning if so
  deleteCategoryModal.classList.add('active');
}

cancelDeleteCategoryBtn.addEventListener('click', () => {
  deleteCategoryModal.classList.remove('active');
  categoryToDelete = null;
  categoryTypeToDelete = null;
});

confirmDeleteCategoryBtn.addEventListener('click', () => {
  if (categoryToDelete && categoryTypeToDelete) {
    // TODO: Check if category is used in transactions before deleting
    const list = categoryTypeToDelete === 'income' ? incomeCategoriesList : expenseCategoriesList;
    const items = Array.from(list.children);
    for (const li of items) {
      if (li.firstChild.textContent === categoryToDelete) {
        list.removeChild(li);
        break;
      }
    }
    showToast('Category deleted.');
    saveCategories();
  }
  deleteCategoryModal.classList.remove('active');
  categoryToDelete = null;
  categoryTypeToDelete = null;
});

// Save categories to localStorage
function saveCategories() {
  const incomeCategories = Array.from(incomeCategoriesList.children).map(li => li.firstChild.textContent);
  const expenseCategories = Array.from(expenseCategoriesList.children).map(li => li.firstChild.textContent);
  const categories = {
    income: incomeCategories,
    expense: expenseCategories
  };
  localStorage.setItem('categories', JSON.stringify(categories));
}

// Load categories from localStorage
function loadCategories() {
  const categories = JSON.parse(localStorage.getItem('categories'));
  if (categories) {
    incomeCategoriesList.innerHTML = '';
    expenseCategoriesList.innerHTML = '';
    categories.income.forEach(cat => {
      incomeCategoriesList.appendChild(createCategoryItem(cat, 'income'));
    });
    categories.expense.forEach(cat => {
      expenseCategoriesList.appendChild(createCategoryItem(cat, 'expense'));
    });
  }
}

// Currency form submission
const currencyForm = document.getElementById('currencyForm');
currencyForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const formData = new FormData(currencyForm);
  const currency = formData.get('currency');
  localStorage.setItem('currency', currency);
  showToast('Currency settings saved.');
});

// Initialize theme on page load
function loadTheme() {
  const savedTheme = localStorage.getItem('theme') || 'system';
  const htmlElement = document.documentElement;
  const themeIcon = document.getElementById('themeIcon');
  const themeRadios = document.querySelectorAll('input[name="theme"]');

  function setTheme(theme) {
    if (theme === 'light') {
      htmlElement.setAttribute('data-theme', 'light');
      themeIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>';
      themeRadios.forEach(radio => {
        radio.checked = radio.value === 'light';
      });
    } else if (theme === 'dark') {
      htmlElement.setAttribute('data-theme', 'dark');
      themeIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>';
      themeRadios.forEach(radio => {
        radio.checked = radio.value === 'dark';
      });
    } else {
      htmlElement.removeAttribute('data-theme');
      themeIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 818.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>';
      themeRadios.forEach(radio => {
        radio.checked = radio.value === 'system';
      });
    }
    localStorage.setItem('theme', theme);
  }

  setTheme(savedTheme);

  // Toggle button click event
  const themeToggleBtn = document.getElementById('themeToggle');
  themeToggleBtn.addEventListener('click', () => {
    const currentTheme = localStorage.getItem('theme') || 'system';
    if (currentTheme === 'light') {
      setTheme('dark');
    } else {
      setTheme('light');
    }
  });

  // Radio buttons change event
  themeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      setTheme(radio.value);
    });
  });
}

// Load notification preferences from localStorage and update toggles
function loadNotificationPrefs() {
  const notificationPrefs = JSON.parse(localStorage.getItem('notificationPrefs'));
  if (notificationPrefs) {
    const expenseAlertsCheckbox = document.getElementById('expenseAlerts');
    const savingsRemindersCheckbox = document.getElementById('savingsReminders');
    const summaryReportsCheckbox = document.getElementById('summaryReports');

    if (expenseAlertsCheckbox) expenseAlertsCheckbox.checked = notificationPrefs.expenseAlerts;
    if (savingsRemindersCheckbox) savingsRemindersCheckbox.checked = notificationPrefs.savingsReminders;
    if (summaryReportsCheckbox) summaryReportsCheckbox.checked = notificationPrefs.summaryReports;
  }
}

// Load categories and theme on page load
document.addEventListener('DOMContentLoaded', () => {
  loadCategories();
  loadTheme();
  loadNotificationPrefs();
});
