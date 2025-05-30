a// TransactionAddForm.js - Component for adding transactions with confirmation messages

class TransactionAddForm {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.transactionService = window.transactionService;
        this.render();
    }

    render() {
        this.container.innerHTML = `
            <form id="transactionAddForm" class="transaction-add-form">
                <h3>Add New Transaction</h3>
                <div>
                    <label for="type">Type:</label>
                    <select id="type" name="type" required>
                        <option value="">Select type</option>
                        <option value="income">Income</option>
                        <option value="expense">Expense</option>
                    </select>
                </div>
                <div>
                    <label for="category">Category:</label>
                    <input type="text" id="category" name="category" required />
                </div>
                <div>
                    <label for="amount">Amount:</label>
                    <input type="number" id="amount" name="amount" min="0.01" step="0.01" required />
                </div>
                <div>
                    <label for="description">Description:</label>
                    <input type="text" id="description" name="description" />
                </div>
                <div>
                    <label for="date">Date:</label>
                    <input type="date" id="date" name="date" />
                </div>
                <button type="submit">Add Transaction</button>
                <div id="transactionMessage" class="transaction-message"></div>
            </form>
        `;

        this.form = this.container.querySelector('#transactionAddForm');
        this.messageDiv = this.container.querySelector('#transactionMessage');

        this.form.addEventListener('submit', this.handleSubmit.bind(this));
    }

    async handleSubmit(event) {
        event.preventDefault();
        this.clearMessage();

        const formData = new FormData(this.form);
        const transaction = {
            type: formData.get('type'),
            category: formData.get('category').trim(),
            amount: parseFloat(formData.get('amount')),
            description: formData.get('description').trim(),
            date: formData.get('date') ? new Date(formData.get('date')).toISOString() : undefined
        };

        // Basic validation
        if (!transaction.type || !transaction.category || isNaN(transaction.amount) || transaction.amount <= 0) {
            this.showMessage('Please fill in all required fields with valid values.', 'error');
            return;
        }

        const result = await this.transactionService.addTransaction(transaction);
        if (result) {
            this.showMessage('Transaction added successfully!', 'success');
            this.form.reset();
        } else {
            this.showMessage('Failed to add transaction. Please try again.', 'error');
        }
    }

    showMessage(message, type) {
        this.messageDiv.textContent = message;
        this.messageDiv.className = 'transaction-message ' + type;
    }

    clearMessage() {
        this.messageDiv.textContent = '';
        this.messageDiv.className = 'transaction-message';
    }
}

// Export as global for usage
window.TransactionAddForm = TransactionAddForm;
