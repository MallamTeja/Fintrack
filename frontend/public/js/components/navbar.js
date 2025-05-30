// Function to set active nav link based on current page
function setActiveNavLink() {
  const currentPage = window.location.pathname.split('/').pop().toLowerCase();
  const navLinks = document.querySelectorAll('nav a');
  
  navLinks.forEach(link => {
    const linkPage = link.getAttribute('data-page');
    if (currentPage.includes(linkPage.toLowerCase())) {
      link.classList.add('active');
      link.classList.remove('hover:bg-blue-500', 'hover:text-white');
    } else {
      link.classList.remove('active');
      link.classList.add('hover:bg-blue-500', 'hover:text-white');
    }
  });

  // Set page title
  const pageTitle = document.getElementById('pageTitle');
  if (pageTitle) {
    const activePage = document.querySelector('nav a.active');
    pageTitle.textContent = activePage ? activePage.title : 'FinTrack';
  }
}

// Theme toggle functionality
function initializeTheme() {
  const htmlElement = document.documentElement;
  const themeToggle = document.getElementById('themeToggle');
  const themeIcon = document.getElementById('themeIcon');

  // Load saved theme
  const savedTheme = localStorage.getItem('theme') || 'light';
  htmlElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme === 'dark');

  // Theme toggle handler
  themeToggle.addEventListener('click', () => {
    const currentTheme = htmlElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    htmlElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme === 'dark');
  });
}

// Update theme icon based on current theme
function updateThemeIcon(isDark) {
  const themeIcon = document.getElementById('themeIcon');
  if (!themeIcon) return;

  themeIcon.innerHTML = isDark ? 
    '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>' :
    '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>';
}

// Initialize all navbar functionality
document.addEventListener('DOMContentLoaded', () => {
  setActiveNavLink();
  initializeTheme();
});

// Export functions for use in other files
export {
  setActiveNavLink,
  initializeTheme,
  updateThemeIcon
}; 