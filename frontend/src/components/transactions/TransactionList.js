import React from 'react';
import { 
  FaMoneyBillWave, FaChartLine, FaBriefcase, 
  FaUtensils, FaHeartbeat, FaFilm, 
  FaFileInvoiceDollar, FaShoppingBag
} from 'react-icons/fa';

const categoryIcons = {
  // Income categories
  'Salary': <FaMoneyBillWave />,
  'Passive Income': <FaChartLine />,
  'Profits from Stocks': <FaChartLine />,
  'Freelancing': <FaBriefcase />,
  
  // Expense categories
  'Food': <FaUtensils />,
  'Medical': <FaHeartbeat />,
  'Entertainment': <FaFilm />,
  'Bills': <FaFileInvoiceDollar />,
  'Other Debits': <FaShoppingBag />
};

const TransactionList = ({ transactions, onEdit, onDelete, type }) => {
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

  // Filter transactions based on type
  const filteredTransactions = transactions.filter(transaction => transaction.type === type);

  return (
    <div className="transactions-list">
      {filteredTransactions.length === 0 ? (
        <div className="no-transactions">
          No {type} transactions found
        </div>
      ) : (
        filteredTransactions.map(transaction => (
          <div key={transaction._id} className="transaction-item">
            <div className="transaction-info">
              <div className="transaction-icon">
                {categoryIcons[transaction.category] || <FaShoppingBag />}
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
        ))
      )}
    </div>
  );
};

export default TransactionList; 