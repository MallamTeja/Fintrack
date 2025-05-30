import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import NavBar from './components/navigation/NavBar';
import Dashboard from './components/dashboard/Dashboard';
import Transactions from './components/transactions/Transactions';
import Budgets from './components/budgets/Budgets';
import SavingsGoals from './components/savings/SavingsGoals';
import Insights from './components/insights/Insights';
import Settings from './components/settings/Settings';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import PrivateRoute from './components/routing/PrivateRoute';
import './App.css';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Simulate fetching user data
  useEffect(() => {
    const fetchUser = async () => {
      try {
        // Replace with actual API call
        const token = localStorage.getItem('token');
        if (token) {
          // Simulated user data
          setCurrentUser({
            id: '1',
            name: 'John Doe',
            email: 'johndoe@example.com',
            avatar: null
          });
        }
      } catch (error) {
        console.error('Error fetching user:', error);
        localStorage.removeItem('token');
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  if (loading) {
    return <div className="loading-spinner">Loading...</div>;
  }

  return (
    <Router>
      <div className="app">
        {/* Navigation bar shows on all pages */}
        <NavBar currentUser={currentUser} />
        
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            
            {/* Protected routes */}
            <Route 
              path="/dashboard" 
              element={
                <PrivateRoute>
                  <Dashboard />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/transactions" 
              element={
                <PrivateRoute>
                  <Transactions />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/budgets" 
              element={
                <PrivateRoute>
                  <Budgets />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/savings" 
              element={
                <PrivateRoute>
                  <SavingsGoals />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/insights" 
              element={
                <PrivateRoute>
                  <Insights />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/settings/*" 
              element={
                <PrivateRoute>
                  <Settings />
                </PrivateRoute>
              } 
            />
            
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;