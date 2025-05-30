/**
 * ApiService - Handles all API communication for the FinTrack application
 * 
 * Features:
 * - Automatic JWT token handling
 * - Error handling and retry logic
 * - Consistent response formatting
 * - Support for all HTTP methods
 */

export class ApiService {
  constructor() {
    this.baseUrl = '/api'; // Base API URL
    this.defaultHeaders = {
      'Content-Type': 'application/json'
    };
    this.maxRetries = 2;
  }

  /**
   * Get the authorization headers with JWT token
   * @returns {Object} Headers object with Authorization if token exists
   */
  getAuthHeaders() {
    const token = localStorage.getItem('token');
    if (!token) {
      return this.defaultHeaders;
    }

    return {
      ...this.defaultHeaders,
      'Authorization': `Bearer ${token}`
    };
  }

  /**
   * Make an API request with retry logic
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Fetch options
   * @param {number} retryCount - Current retry count
   * @returns {Promise<any>} Response data
   */
  async request(endpoint, options = {}, retryCount = 0) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = this.getAuthHeaders();
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...headers,
          ...options.headers
        }
      });

      // Handle 401 Unauthorized (token expired)
      if (response.status === 401 && localStorage.getItem('token')) {
        localStorage.removeItem('token');
        // Redirect to login page if token is invalid
        window.location.href = '/login.html';
        throw new Error('Authentication token expired. Please log in again.');
      }

      // Handle other error responses
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
      }

      // Parse JSON response
      const data = await response.json().catch(() => ({}));
      return data;
    } catch (error) {
      // Retry logic for network errors
      if (retryCount < this.maxRetries && (error.message.includes('network') || error.message.includes('failed to fetch'))) {
        console.warn(`Request failed, retrying (${retryCount + 1}/${this.maxRetries})...`, error);
        return new Promise(resolve => {
          setTimeout(() => {
            resolve(this.request(endpoint, options, retryCount + 1));
          }, 1000 * Math.pow(2, retryCount)); // Exponential backoff
        });
      }

      // Re-throw the error after max retries
      throw error;
    }
  }

  /**
   * Make a GET request
   * @param {string} endpoint - API endpoint
   * @param {Object} params - Query parameters
   * @returns {Promise<any>} Response data
   */
  async get(endpoint, params = {}) {
    const queryString = Object.keys(params).length 
      ? `?${new URLSearchParams(params).toString()}`
      : '';
      
    return this.request(`${endpoint}${queryString}`, {
      method: 'GET'
    });
  }

  /**
   * Make a POST request
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request body
   * @returns {Promise<any>} Response data
   */
  async post(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  /**
   * Make a PATCH request
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request body
   * @returns {Promise<any>} Response data
   */
  async patch(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  /**
   * Make a PUT request
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request body
   * @returns {Promise<any>} Response data
   */
  async put(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  /**
   * Make a DELETE request
   * @param {string} endpoint - API endpoint
   * @returns {Promise<any>} Response data
   */
  async delete(endpoint) {
    return this.request(endpoint, {
      method: 'DELETE'
    });
  }
}

// For backwards compatibility with non-module scripts
window.apiService = new ApiService();
