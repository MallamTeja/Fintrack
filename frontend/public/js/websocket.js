class WebSocketClient {
    constructor() {
        this.connect();
        this.handlers = new Map();
        this.isAuthenticated = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.authenticationPromise = null;
    }

    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        this.ws = new WebSocket(`${protocol}//${host}`);

        this.ws.onopen = () => {
            console.log('WebSocket: Connected');
            this.reconnectAttempts = 0;
            this.authenticate();
        };

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log('WebSocket: Received message:', data.type);
            
            // Handle authentication response
            if (data.type === 'auth') {
                if (data.status === 'error') {
                    console.error('WebSocket: Authentication failed:', data.message);
                    this.isAuthenticated = false;
                    // Don't redirect, just log the error
                } else {
                    console.log('WebSocket: Authentication successful');
                    this.isAuthenticated = true;
                }
                return;
            }

            // Only process messages if authenticated
            if (this.isAuthenticated) {
                const handler = this.handlers.get(data.type);
                if (handler) {
                    handler(data.data);
                }
            } else {
                console.log('WebSocket: Ignoring message, not authenticated');
            }
        };

        this.ws.onclose = () => {
            console.log('WebSocket: Disconnected');
            this.isAuthenticated = false;
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                console.log(`WebSocket: Reconnecting (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
                this.reconnectAttempts++;
                setTimeout(() => this.connect(), 5000);
            } else {
                console.log('WebSocket: Max reconnection attempts reached');
            }
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket: Error:', error);
        };
    }

    authenticate() {
        console.log('WebSocket: Starting authentication');
        const token = localStorage.getItem('token');
        if (token) {
            console.log('WebSocket: Token found, sending authentication request');
            this.ws.send(JSON.stringify({
                type: 'auth',
                token: token
            }));
        } else {
            console.log('WebSocket: No token available for authentication');
            this.isAuthenticated = false;
        }
    }

    // Register handlers for different event types
    on(type, handler) {
        console.log('WebSocket: Registering handler for', type);
        this.handlers.set(type, handler);
    }

    // Remove handler for an event type
    off(type) {
        console.log('WebSocket: Removing handler for', type);
        this.handlers.delete(type);
    }
}

// Create and export WebSocket client instance
window.wsClient = new WebSocketClient();

// Example usage in other files:
/*
wsClient.on('transactionAdded', (transaction) => {
    // Update UI with new transaction
});

wsClient.on('transactionUpdated', (transaction) => {
    // Update UI with modified transaction
});

wsClient.on('transactionDeleted', ({ transactionId }) => {
    // Remove transaction from UI
});

wsClient.on('balanceUpdated', ({ balance }) => {
    // Update balance display
});
*/ 