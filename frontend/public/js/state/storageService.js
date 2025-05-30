/**
 * StorageService - Handles localStorage operations with error handling and expiration
 * 
 * Features:
 * - Get, set, and remove items from localStorage
 * - Support for item expiration
 * - JSON serialization/deserialization
 * - Error handling for storage limits and parsing errors
 */

export class StorageService {
  constructor() {
    this.prefix = 'fintrack_'; // Namespace for all storage keys
  }

  /**
   * Get the prefixed key
   * @param {string} key - Original key
   * @returns {string} Prefixed key
   */
  getKey(key) {
    return `${this.prefix}${key}`;
  }

  /**
   * Get an item from localStorage
   * @param {string} key - Storage key
   * @returns {*} Parsed value or null if not found
   */
  get(key) {
    try {
      const prefixedKey = this.getKey(key);
      const item = localStorage.getItem(prefixedKey);
      
      if (!item) {
        return null;
      }
      
      const { value, expiry } = JSON.parse(item);
      
      // Check if the item has expired
      if (expiry && expiry < Date.now()) {
        this.remove(key);
        return null;
      }
      
      return value;
    } catch (error) {
      console.error(`Error getting item from localStorage (${key}):`, error);
      return null;
    }
  }

  /**
   * Set an item in localStorage with optional expiration
   * @param {string} key - Storage key
   * @param {*} value - Value to store
   * @param {number} [ttl] - Time to live in milliseconds
   * @returns {boolean} Success status
   */
  set(key, value, ttl = null) {
    try {
      const prefixedKey = this.getKey(key);
      const item = {
        value,
        expiry: ttl ? Date.now() + ttl : null
      };
      
      localStorage.setItem(prefixedKey, JSON.stringify(item));
      return true;
    } catch (error) {
      // Handle storage quota exceeded
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.error('Storage quota exceeded. Clearing expired items...');
        this.clearExpired();
        
        // Try again after clearing
        try {
          return this.set(key, value, ttl);
        } catch (retryError) {
          console.error(`Failed to set item after clearing expired (${key}):`, retryError);
          return false;
        }
      }
      
      console.error(`Error setting item in localStorage (${key}):`, error);
      return false;
    }
  }

  /**
   * Remove an item from localStorage
   * @param {string} key - Storage key
   * @returns {boolean} Success status
   */
  remove(key) {
    try {
      const prefixedKey = this.getKey(key);
      localStorage.removeItem(prefixedKey);
      return true;
    } catch (error) {
      console.error(`Error removing item from localStorage (${key}):`, error);
      return false;
    }
  }

  /**
   * Clear all items with the prefix
   * @returns {boolean} Success status
   */
  clear() {
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(this.prefix)) {
          localStorage.removeItem(key);
        }
      });
      return true;
    } catch (error) {
      console.error('Error clearing localStorage:', error);
      return false;
    }
  }

  /**
   * Clear all expired items
   * @returns {number} Number of items cleared
   */
  clearExpired() {
    try {
      let cleared = 0;
      const now = Date.now();
      
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(this.prefix)) {
          try {
            const item = JSON.parse(localStorage.getItem(key));
            if (item.expiry && item.expiry < now) {
              localStorage.removeItem(key);
              cleared++;
            }
          } catch (parseError) {
            // If we can't parse it, remove it
            localStorage.removeItem(key);
            cleared++;
          }
        }
      });
      
      return cleared;
    } catch (error) {
      console.error('Error clearing expired items:', error);
      return 0;
    }
  }

  /**
   * Get the total size of localStorage in bytes
   * @returns {number} Size in bytes
   */
  getSize() {
    try {
      let size = 0;
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(this.prefix)) {
          size += localStorage.getItem(key).length * 2; // UTF-16 characters (2 bytes each)
        }
      });
      return size;
    } catch (error) {
      console.error('Error calculating localStorage size:', error);
      return 0;
    }
  }

  /**
   * Check if localStorage is available
   * @returns {boolean} Availability status
   */
  isAvailable() {
    try {
      const testKey = `${this.prefix}test`;
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch (error) {
      console.error('localStorage is not available:', error);
      return false;
    }
  }
}

// For backwards compatibility with non-module scripts
window.storageService = new StorageService();
