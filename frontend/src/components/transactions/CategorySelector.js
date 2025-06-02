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

const CategorySelector = ({ type, selectedCategory, onSelect }) => {
  const categories = type === 'income' 
    ? ['Salary', 'Passive Income', 'Profits from Stocks', 'Freelancing']
    : ['Food', 'Medical', 'Entertainment', 'Bills', 'Other Debits'];

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