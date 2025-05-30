/**
 * Logout Handler
 * Attaches event listener to logout button to handle user logout
 */

import { store } from '../state/index.js';

function setupLogout() {
  const attachListener = () => {
    const logoutButton = document.getElementById('logoutButton');
    const profileButton = document.getElementById('profileButton');
    const profileDropdown = document.getElementById('profileDropdown');

    if (!logoutButton || !profileButton || !profileDropdown) return;

    // Remove any existing listener to avoid duplicates
    logoutButton.removeEventListener('click', handleLogout);
    profileButton.removeEventListener('click', toggleProfileDropdown);
    document.removeEventListener('click', closeProfileDropdown);

    logoutButton.addEventListener('click', handleLogout);
    profileButton.addEventListener('click', toggleProfileDropdown);
    document.addEventListener('click', closeProfileDropdown);
  };

  const handleLogout = (e) => {
    e.stopPropagation();
    console.log('Logout clicked');

    // Remove token from localStorage
    localStorage.removeItem('token');

    // Reset state via store
    if (store) {
      store.dispatch('user:logout');
    }

    // Redirect to login page
    window.location.href = '/login.html';
  };

  const toggleProfileDropdown = (e) => {
    e.stopPropagation();
    const profileButton = e.currentTarget;
    const profileDropdown = document.getElementById('profileDropdown');
    const isExpanded = profileButton.getAttribute('aria-expanded') === 'true';
    if (isExpanded) {
      profileDropdown.classList.add('hidden');
      profileButton.setAttribute('aria-expanded', 'false');
    } else {
      profileDropdown.classList.remove('hidden');
      profileButton.setAttribute('aria-expanded', 'true');
    }
  };

  const closeProfileDropdown = () => {
    const profileButton = document.getElementById('profileButton');
    const profileDropdown = document.getElementById('profileDropdown');
    if (!profileDropdown.classList.contains('hidden')) {
      profileDropdown.classList.add('hidden');
      profileButton.setAttribute('aria-expanded', 'false');
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachListener);
  } else {
    // DOM already loaded
    attachListener();
  }
}

// Setup logout and profile dropdown on script load
setupLogout();

// Export for ES modules
export { setupLogout };

// For non-module scripts
window.setupLogout = setupLogout;
