import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import './NavBar.css';

const NavBar = ({ currentUser }) => {
  const location = useLocation();
  const path = location.pathname;

  // Helper to check if link is active
  const isActive = (linkPath) => path === linkPath || path.startsWith(linkPath + '/');

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2 className="sidebar-logo">FinTrack</h2>
        <p className="sidebar-tagline">track your money</p>
      </div>
      <nav className="sidebar-nav">
        <Link to="/dashboard" className={`sidebar-link ${isActive('/dashboard') ? 'active' : ''}`}>
          <svg className="sidebar-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
          </svg>
          Dashboard
        </Link>
        <Link to="/addTransactions" className={`sidebar-link ${isActive('/addTransactions') ? 'active' : ''}`}>
          <svg className="sidebar-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
          </svg>
          Transactions
        </Link>
        <Link to="/insights" className={`sidebar-link ${isActive('/insights') ? 'active' : ''}`}>
          <svg className="sidebar-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
          </svg>
          Insights
        </Link>
        <Link to="/savingGoals" className={`sidebar-link ${isActive('/savingGoals') ? 'active' : ''}`}>
          <svg className="sidebar-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/>
          </svg>
          Savings Goals
        </Link>
        <Link to="/expensesLimits" className={`sidebar-link ${isActive('/expensesLimits') ? 'active' : ''}`}>
          <svg className="sidebar-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          Expenses Limits
        </Link>
        <Link to="/settings" className={`sidebar-link ${isActive('/settings') ? 'active' : ''}`}>
          <svg className="sidebar-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
          Settings
        </Link>
      </nav>
      <div className="sidebar-user">
        {currentUser ? (
          <div className="user-profile">
            <div className="user-avatar">
              {currentUser.avatar ? (
                <img src={currentUser.avatar} alt={`${currentUser.name}'s avatar`} />
              ) : (
                <span>{currentUser.name.charAt(0)}</span>
              )}
            </div>
            <div className="user-dropdown">
              <span className="user-name">{currentUser.name}</span>
              <div className="dropdown-content">
                <Link to="/settings/profile">Profile</Link>
                <Link to="/settings/account">Account</Link>
                <button className="logout-button">Log Out</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="auth-buttons">
            <Link to="/login" className="login-button">Log In</Link>
            <Link to="/register" className="register-button">Sign Up</Link>
          </div>
        )}
      </div>
    </aside>
  );
};

export default NavBar;
