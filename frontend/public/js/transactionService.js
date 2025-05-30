// TransactionService to manage transactions state across pages
class TransactionService {
    constructor() {
        this.transactions = [];
        this.subscribers = [];
        this.apiUrl = '/api/transactions'; // API endpoint
        this.token = localStorage.getItem('token');
        
        // Load initial data
        this.fetchTransactions();

        // Subscribe to websocket events for real-time updates
        if (window.websocketService) {
            window.websocketService.subscribe('transaction_added', this.handleTransactionAdded.bind(this));
            window.websocketService.subscribe('transaction_updated', this.handleTransactionUpdated.bind(this));
        }
    }
    
    // Subscribe to transaction updates
    subscribe(callback) {
        this.subscribers.push(callback);
        callback(this.transactions); // Initial call with current data
    }

    // Notify all subscribers of changes
    notifySubscribers() {
        this.subscribers.forEach(callback => callback(this.transactions));
    }
    
    // Fetch transactions from the API
    async fetchTransactions() {
        try {
            const response = await fetch(this.apiUrl, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch transactions');
            }
            
            this.transactions = await response.json();
            this.notifySubscribers();
        } catch (error) {
            console.error('Error fetching transactions:', error);
            this.transactions = [];
            this.notifySubscribers();
        }
    }

    // Add new transaction
    async addTransaction(transaction) {
        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(transaction)
            });
            
            if (!response.ok) {
                throw new Error('Failed to add transaction');
            }
            
            const newTransaction = await response.json();
            this.transactions.unshift(newTransaction);
            this.notifySubscribers();
            
            return newTransaction;
        } catch (error) {
            console.error('Error adding transaction:', error);
            return null;
        }
    }

    // Handle websocket event for transaction added
    handleTransactionAdded(transaction) {
        // Avoid duplicates
        if (!this.transactions.find(tx => tx._id === transaction._id)) {
            this.transactions.unshift(transaction);
            this.notifySubscribers();
        }
    }

    // Handle websocket event for transaction updated
    handleTransactionUpdated(updatedTransaction) {
        const index = this.transactions.findIndex(tx => tx._id === updatedTransaction._id);
        if (index !== -1) {
            this.transactions[index] = updatedTransaction;
            this.notifySubscribers();
        }
    }
}

// Create global instance
window.transactionService = new TransactionService();
