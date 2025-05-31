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

// Initialize navbar functionality
document.addEventListener('DOMContentLoaded', () => {
  setActiveNavLink();
});

// Export functions for use in other files
export {
  setActiveNavLink
}; 