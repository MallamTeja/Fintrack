import React, { useState } from 'react';
import CategorySelector from './CategorySelector';

const TransactionForm = ({ onSubmit }) => {
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      type,
      amount: parseFloat(amount),
      date,
      category,
      description: description.trim()
    });
  };

  return (
    <form onSubmit={handleSubmit} className="transaction-form">
      <div className="form-group">
        <label>Transaction Type</label>
        <div className="transaction-type">
          <button
            type="button"
            className={`type-btn ${type === 'income' ? 'active' : ''}`}
            onClick={() => setType('income')}
          >
            <i className="fas fa-arrow-down"></i> Income
          </button>
          <button
            type="button"
            className={`type-btn ${type === 'expense' ? 'active' : ''}`}
            onClick={() => setType('expense')}
          >
            <i className="fas fa-arrow-up"></i> Expense
          </button>
        </div>
      </div>

      <div className="form-group">
        <label>Amount (₹)</label>
        <div className="amount-input-group">
          <span className="currency-symbol">₹</span>
          <input
            type="number"
            className="amount-input"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            required
          />
        </div>
      </div>

      <div className="form-group">
        <label>Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </div>

      <div className="form-group">
        <label>Category</label>
        <CategorySelector
          type={type}
          selectedCategory={category}
          onSelect={setCategory}
        />
      </div>

      <div className="form-group">
        <label>Description (Optional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What's this transaction for?"
        />
      </div>

      <div className="form-actions">
        <button type="reset" className="btn btn-secondary">Reset</button>
        <button type="submit" className="btn btn-primary">Add Transaction</button>
      </div>
    </form>
  );
};

export default TransactionForm; 