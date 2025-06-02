import React, { useEffect, useState } from 'react';
import UserWelcome from '../navigation/UserWelcome';
import TransactionForm from '../transactions/TransactionForm';
import TransactionList from '../transactions/TransactionList';

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState('income');

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          window.location.href = '/login';
          return;
        }

        const response = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch user data');
        }

        const userData = await response.json();
        setUser(userData);
      } catch (error) {
        console.error('Error fetching user data:', error);
        window.location.href = '/login';
      }
    };

    const fetchTransactions = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/transactions', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch transactions');
        }

        const data = await response.json();
        setTransactions(data);
      } catch (error) {
        console.error('Error fetching transactions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
    fetchTransactions();
  }, []);

  const handleTransactionSubmit = async (transactionData) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(transactionData)
      });

      if (!response.ok) {
        throw new Error('Failed to add transaction');
      }

      const newTransaction = await response.json();
      setTransactions(prev => [newTransaction, ...prev]);
    } catch (error) {
      console.error('Error adding transaction:', error);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="dashboard">
      {user && (
        <UserWelcome
          user={user}
          lastLoginTime={user.lastLoginTime}
        />
      )}
      
      <div className="dashboard-grid">
        <div className="dashboard-main">
          <TransactionForm onSubmit={handleTransactionSubmit} />
        </div>
        
        <div className="dashboard-sidebar">
          <div className="transaction-type-selector">
            <button 
              className={`type-button ${selectedType === 'income' ? 'active' : ''}`}
              onClick={() => setSelectedType('income')}
            >
              Income
            </button>
            <button 
              className={`type-button ${selectedType === 'expense' ? 'active' : ''}`}
              onClick={() => setSelectedType('expense')}
            >
              Expenses
            </button>
          </div>
          <TransactionList
            transactions={transactions}
            onEdit={(transaction) => {
              // Handle edit
            }}
            onDelete={(id) => {
              // Handle delete
            }}
            type={selectedType}
          />
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 