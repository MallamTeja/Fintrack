/**
 * FinTrack Application JavaScript
 * Combines all shared functionality into a single organized file
 */

// Main Application Class
class FinTrackApp {
    constructor() {
        this.navigation = null;
        this.websocket = null;
        
        // Initialize app when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            this.initialize();
        }
    }

    async initialize() {
        console.log('Initializing FinTrack Application...');
        
        // First include all components
        await this.includeComponents();
        
        // Initialize navigation
        this.navigation = new NavigationManager();
        
        // Initialize WebSocket if we have a token
        if (localStorage.getItem('token')) {
            this.websocket = new WebSocketManager();
            this.websocket.connect();
        }
    }

    async includeComponents() {
        const includes = document.getElementsByTagName('include');
        
        for (let i = 0; i < includes.length; i++) {
            const include = includes[i];
            const file = include.getAttribute('src');
            
            try {
                const response = await fetch(file);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const content = await response.text();
                
                // Create a temporary container
                const temp = document.createElement('div');
                temp.innerHTML = content;
                
                // Replace the include tag with the content
                include.parentNode.replaceChild(temp.firstChild, include);
                
                // If this was the navigation component, dispatch the event
                if (file.includes('navigation.html')) {
                    document.dispatchEvent(new CustomEvent('navigationLoaded'));
                }
            } catch (error) {
                console.error(`Error including ${file}:`, error);
                include.innerHTML = `Error loading component: ${file}`;
            }
        }
    }
}

// Navigation Management
class NavigationManager {
    constructor() {
        this.isInitialized = false;
        
        // Bind methods
        this.initialize = this.initialize.bind(this);
        this.handleDropdownClick = this.handleDropdownClick.bind(this);
        this.handleClickOutside = this.handleClickOutside.bind(this);
        this.handleLogout = this.handleLogout.bind(this);
        
        // Initialize when navigation is loaded
        document.addEventListener('navigationLoaded', () => {
            console.log('Navigation loaded event received');
            this.initialize();
        });

        // Global click handler for closing dropdown
        document.addEventListener('click', this.handleClickOutside);
    }

    initialize() {
        console.log('Initializing NavigationManager...');
        
        if (this.isInitialized) {
            console.log('Already initialized, cleaning up old listeners');
            this.cleanup();
        }

        // Get elements
        this.userMenuButton = document.getElementById('userMenuButton');
        this.userDropdown = document.getElementById('userDropdown');
        this.logoutButton = document.getElementById('logoutButton');

        if (!this.userMenuButton || !this.userDropdown) {
            console.error('Required navigation elements not found');
            return;
        }

        // Add click handler for dropdown toggle
        this.userMenuButton.addEventListener('click', this.handleDropdownClick);
        
        // Add click handler for logout
        if (this.logoutButton) {
            this.logoutButton.addEventListener('click', this.handleLogout);
        }

        // Load user info
        this.loadUserInfo();

        // Check authentication
        this.checkAuth();

        this.isInitialized = true;
        console.log('NavigationManager initialized successfully');
    }

    cleanup() {
        // Remove old event listeners if elements exist
        if (this.userMenuButton) {
            this.userMenuButton.removeEventListener('click', this.handleDropdownClick);
        }
        if (this.logoutButton) {
            this.logoutButton.removeEventListener('click', this.handleLogout);
        }
    }

    handleDropdownClick(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('Dropdown click handled');
        
        if (this.userDropdown) {
            const isShown = this.userDropdown.classList.contains('show');
            // Close any open dropdowns first
            const dropdowns = document.getElementsByClassName('dropdown-content');
            Array.from(dropdowns).forEach(dropdown => {
                dropdown.classList.remove('show');
            });
            
            // Toggle current dropdown
            if (!isShown) {
                this.userDropdown.classList.add('show');
            }
        }
    }

    handleClickOutside(e) {
        if (!e.target.closest('#userMenuButton') && !e.target.closest('#userDropdown')) {
            const dropdowns = document.getElementsByClassName('dropdown-content');
            Array.from(dropdowns).forEach(dropdown => {
                dropdown.classList.remove('show');
            });
        }
    }

    checkAuth() {
        const token = localStorage.getItem('token');
        const isLoginPage = window.location.pathname.includes('login.html');
        const isRegisterPage = window.location.pathname.includes('register.html');

        if (!token && !isLoginPage && !isRegisterPage) {
            console.log('No token found, redirecting to login');
            window.location.href = '/login.html';
            return false;
        }
        return true;
    }

    async loadUserInfo() {
        console.log('Loading user info...');
        const usernameElement = document.getElementById('username');
        if (!usernameElement) {
            console.error('Username element not found');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('No token found');
            }

            const response = await fetch('/api/auth/me', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch user info');
            }

            const userData = await response.json();
            usernameElement.textContent = userData.name || userData.email;
            console.log('User info loaded successfully');
        } catch (error) {
            console.error('Error loading user info:', error);
            usernameElement.textContent = 'User';
            
            if (error.message.includes('token') || error.message.includes('unauthorized')) {
                this.handleLogout();
            }
        }
    }

    handleLogout(e) {
        if (e) {
            e.preventDefault();
        }
        console.log('Handling logout...');
        // Clear all authentication data
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        // Disconnect WebSocket if it exists
        if (window.wsClient) {
            window.wsClient.disconnect();
        }

        // Redirect to login page
        window.location.href = '/login.html';
    }
}

// WebSocket Management
class WebSocketManager {
    constructor() {
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000; // Start with 1 second delay
        this.isConnected = false;
        this.handlers = new Map();

        // Bind methods
        this.connect = this.connect.bind(this);
        this.disconnect = this.disconnect.bind(this);
        this.reconnect = this.reconnect.bind(this);
        this.handleMessage = this.handleMessage.bind(this);
    }

    connect() {
        if (this.ws) {
            return;
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        
        try {
            this.ws = new WebSocket(`${protocol}//${host}`);

            this.ws.onopen = () => {
                console.log('WebSocket connected');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.authenticate();
            };

            this.ws.onclose = () => {
                console.log('WebSocket disconnected');
                this.isConnected = false;
                this.reconnect();
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.isConnected = false;
            };

            this.ws.onmessage = this.handleMessage;
        } catch (error) {
            console.error('Error creating WebSocket:', error);
            this.reconnect();
        }
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
            this.isConnected = false;
        }
    }

    reconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('Max reconnection attempts reached');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        
        console.log(`Attempting to reconnect in ${delay}ms...`);
        setTimeout(this.connect, delay);
    }

    authenticate() {
        const token = localStorage.getItem('token');
        if (token && this.isConnected) {
            this.send({
                type: 'auth',
                token: token
            });
        }
    }

    handleMessage(event) {
        try {
            const data = JSON.parse(event.data);
            console.log('WebSocket message received:', data);

            if (data.type === 'auth') {
                if (data.status === 'success') {
                    console.log('WebSocket authenticated');
                } else {
                    console.error('WebSocket authentication failed:', data.message);
                    this.disconnect();
                }
                return;
            }

            const handler = this.handlers.get(data.type);
            if (handler) {
                handler(data.payload);
            }
        } catch (error) {
            console.error('Error handling WebSocket message:', error);
        }
    }

    send(data) {
        if (this.isConnected) {
            try {
                this.ws.send(JSON.stringify(data));
            } catch (error) {
                console.error('Error sending WebSocket message:', error);
            }
        } else {
            console.warn('Cannot send message: WebSocket not connected');
        }
    }

    subscribe(event, handler) {
        this.handlers.set(event, handler);
    }

    unsubscribe(event) {
        this.handlers.delete(event);
    }
}

// Initialize the application
window.app = new FinTrackApp(); 