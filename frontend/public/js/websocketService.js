// WebSocket Service for real-time updates
class WebSocketService {
    constructor() {
        this.socket = null;
        this.subscribers = new Map();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000; // Start with 1 second
        this.token = localStorage.getItem('token'); // Get JWT token from localStorage
    }

    connect() {
        try {
            this.socket = new WebSocket('ws://localhost:3000');

            this.socket.onopen = () => {
                console.log('WebSocket connected');
                this.reconnectAttempts = 0;
                this.reconnectDelay = 1000;

                // Send subscribe message with token for authentication
                if (this.token) {
                    this.send('subscribe', { token: this.token });
                }
            };

            this.socket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.notifySubscribers(data);
            };

            this.socket.onclose = () => {
                console.log('WebSocket disconnected');
                this.attemptReconnect();
            };

            this.socket.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
        } catch (error) {
            console.error('Failed to connect to WebSocket:', error);
            this.attemptReconnect();
        }
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            setTimeout(() => {
                console.log(`Attempting to reconnect... (${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
                this.reconnectAttempts++;
                this.reconnectDelay *= 2; // Exponential backoff
                this.connect();
            }, this.reconnectDelay);
        } else {
            console.error('Max reconnection attempts reached');
        }
    }

    subscribe(eventType, callback) {
        if (!this.subscribers.has(eventType)) {
            this.subscribers.set(eventType, new Set());
        }
        this.subscribers.get(eventType).add(callback);
    }

    unsubscribe(eventType, callback) {
        if (this.subscribers.has(eventType)) {
            this.subscribers.get(eventType).delete(callback);
        }
    }

    notifySubscribers(data) {
        const { type, payload } = data;
        if (this.subscribers.has(type)) {
            this.subscribers.get(type).forEach(callback => callback(payload));
        }
    }

    send(type, data) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ type, ...data }));
        } else {
            console.error('WebSocket is not connected');
        }
    }
}

window.FinTrackState = window.FinTrackState || {};
window.FinTrackState.webSocketService = new WebSocketService();
window.addEventListener('load', () => window.FinTrackState.webSocketService.connect());
