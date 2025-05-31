// Theme management system
class ThemeManager {
  constructor() {
    console.log('ThemeManager: Initializing...');
    this.htmlElement = document.documentElement;
    this.themeToggle = document.getElementById('themeToggle');
    this.themeIcon = document.getElementById('themeIcon');
    
    if (!this.themeToggle) {
      console.error('ThemeManager: Theme toggle button not found!');
      return;
    }
    
    if (!this.themeIcon) {
      console.error('ThemeManager: Theme icon not found!');
      return;
    }
    
    console.log('ThemeManager: Elements found, initializing theme...');
    // Initialize theme
    this.initializeTheme();
    
    // Add event listeners
    this.addEventListeners();
  }

  initializeTheme() {
    console.log('ThemeManager: Initializing theme...');
    // Load saved theme or use system preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      console.log('ThemeManager: Using saved theme:', savedTheme);
      this.setTheme(savedTheme);
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      console.log('ThemeManager: Using system preference:', prefersDark ? 'dark' : 'light');
      this.setTheme(prefersDark ? 'dark' : 'light');
    }
  }

  setTheme(theme) {
    console.log('ThemeManager: Setting theme to:', theme);
    this.htmlElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    this.updateThemeIcon(theme === 'dark');
    
    // Dispatch theme change event
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
  }

  toggleTheme() {
    console.log('ThemeManager: Toggling theme...');
    const currentTheme = this.htmlElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    this.setTheme(newTheme);
  }

  updateThemeIcon(isDark) {
    console.log('ThemeManager: Updating theme icon, isDark:', isDark);
    if (!this.themeIcon) {
      console.error('ThemeManager: Theme icon not found when updating!');
      return;
    }
    
    this.themeIcon.innerHTML = isDark ? 
      '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>' :
      '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>';
  }

  addEventListeners() {
    console.log('ThemeManager: Adding event listeners...');
    // Theme toggle click handler
    if (this.themeToggle) {
      this.themeToggle.addEventListener('click', () => {
        console.log('ThemeManager: Theme toggle clicked');
        this.toggleTheme();
      });
    } else {
      console.error('ThemeManager: Theme toggle button not found when adding event listener!');
    }

    // System theme change handler
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      console.log('ThemeManager: System theme changed:', e.matches ? 'dark' : 'light');
      if (!localStorage.getItem('theme')) {
        this.setTheme(e.matches ? 'dark' : 'light');
      }
    });
  }
}

// Initialize theme manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('ThemeManager: DOM loaded, creating instance...');
  window.themeManager = new ThemeManager();
}); 