// User Profile Management
export class UserProfile {
  constructor() {
    this.profileButton = document.getElementById('profileButton');
    this.profileDropdown = document.getElementById('profileDropdown');
    this.logoutButton = document.getElementById('logoutButton');
    
    if (!this.profileButton || !this.profileDropdown || !this.logoutButton) {
      console.error('Required user profile elements not found');
      return;
    }
    
    this.init();
  }

  init() {
    // Toggle dropdown on profile button click
    this.profileButton.addEventListener('click', (e) => {
      e.stopPropagation();
      const isExpanded = this.profileButton.getAttribute('aria-expanded') === 'true';
      this.toggleDropdown(!isExpanded);
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.profileButton.contains(e.target)) {
        this.toggleDropdown(false);
      }
    });

    // Handle logout
    this.logoutButton.addEventListener('click', () => {
      this.handleLogout();
    });
  }

  toggleDropdown(show) {
    if (!this.profileButton || !this.profileDropdown) return;
    
    this.profileDropdown.classList.toggle('hidden', !show);
    this.profileButton.setAttribute('aria-expanded', show);
  }

  handleLogout() {
    // Clear any stored user data
    localStorage.removeItem('user');
    // Redirect to login page
    window.location.href = '/login.html';
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  new UserProfile();
}); 