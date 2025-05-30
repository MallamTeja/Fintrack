/**
 * Authentication Check Utility for FinTrack
 * 
 * This module provides authentication verification functionality to ensure
 * users are properly authenticated before accessing protected pages.
 */

/**
 * Check if the user is authenticated
 * - Verifies JWT token exists in localStorage
 * - Redirects to login page if not authenticated
 * - Can optionally verify token validity with the backend
 * 
 * @param {boolean} verifyWithBackend - Whether to verify token with backend
 * @returns {boolean} - Whether the user is authenticated
 */
function checkAuthentication(verifyWithBackend = false) {
  console.log('Checking authentication status...');
  
  // Get token from localStorage
  const token = localStorage.getItem('token');
  
  // If no token exists, redirect to login
  if (!token) {
    console.log('No authentication token found, redirecting to login');
    window.location.href = '/login.html';
    return false;
  }
  
  // If verifyWithBackend is true, make API call to verify token
  if (verifyWithBackend) {
    // Use async IIFE to handle the async verification
    (async () => {
      try {
        const response = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          console.log('Token verification failed, redirecting to login');
          localStorage.removeItem('token');
          window.location.href = '/login.html';
          return false;
        }
        
        // Token is valid, user is authenticated
        console.log('Token verified with backend, user is authenticated');
        return true;
      } catch (error) {
        console.error('Error verifying token:', error);
        // Don't redirect on network errors to prevent logout on temporary connectivity issues
        return false;
      }
    })();
  }
  
  // If we're not verifying with backend, just return true if token exists
  console.log('Token exists, user is authenticated');
  return true;
}

// Export for ES modules
export { checkAuthentication };

// For non-module scripts, expose to global window object
window.authCheck = {
  checkAuthentication
};

// Auto-run authentication check when script is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Only run on protected pages (not login or register)
  const currentPage = window.location.pathname;
  if (
    currentPage !== '/login.html' && 
    currentPage !== '/register.html' && 
    currentPage !== '/index.html' &&
    currentPage !== '/'
  ) {
    checkAuthentication();
  }
});
