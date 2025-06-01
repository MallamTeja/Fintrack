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

const CategorySelector = ({ type, selectedCategory, onSelect }) => {
  const categories = type === 'income' 
    ? ['Salary', 'Credits', 'Passive Income', 'Profits from Stocks', 'Investments', 'Business Income']
    : ['Food', 'Medical', 'Entertainment', 'Shopping', 'Bills', 'Transportation'];

  return (
    <div className="category-selector">
      <div className="category-buttons">
        {categories.map(category => (
          <button
            key={category}
            className={`category-button ${selectedCategory === category ? 'selected' : ''}`}
            onClick={() => onSelect(category)}
          >
            <span className="category-icon">{categoryIcons[category]}</span>
            <span className="category-name">{category}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default CategorySelector; 