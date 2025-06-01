import React from 'react';
import { 
  FaMoneyBillWave, FaCreditCard, FaChartLine, FaPiggyBank, 
  FaBriefcase, FaStore, FaUtensils, FaHeartbeat, 
  FaFilm, FaShoppingBag, FaFileInvoiceDollar, FaCar 
} from 'react-icons/fa';

const categoryIcons = {
  // Income categories
  'Salary': <FaMoneyBillWave />,
  'Credits': <FaCreditCard />,
  'Passive Income': <FaChartLine />,
  'Profits from Stocks': <FaChartLine />,
  'Investments': <FaPiggyBank />,
  'Business Income': <FaBriefcase />,
  
  // Expense categories
  'Food': <FaUtensils />,
  'Medical': <FaHeartbeat />,
  'Entertainment': <FaFilm />,
  'Shopping': <FaShoppingBag />,
  'Bills': <FaFileInvoiceDollar />,
  'Transportation': <FaCar />
};

const TransactionList = ({ transactions, onEdit, onDelete }) => {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="transactions-list">
      {transactions.map(transaction => (
        <div key={transaction._id} className="transaction-item">
          <div className="transaction-info">
            <div className="transaction-icon">
              {categoryIcons[transaction.category] || <FaStore />}
            </div>
            <div className="transaction-details">
              <div className="transaction-title">
                {transaction.category || 'No category'}
              </div>
              <div className="transaction-description">
                {transaction.description || 'No description'}
              </div>
              <div className="transaction-date">
                {formatDate(transaction.date)}
              </div>
            </div>
          </div>
          <div className="transaction-amount">
            <span className={transaction.type === 'income' ? 'income' : 'expense'}>
              {transaction.type === 'income' ? '+' : '-'} {formatCurrency(transaction.amount)}
            </span>
          </div>
          <div className="transaction-actions">
            <button onClick={() => onEdit(transaction)} className="edit-btn">
              Edit
            </button>
            <button onClick={() => onDelete(transaction._id)} className="delete-btn">
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TransactionList; 