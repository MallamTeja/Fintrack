import React from 'react';
import { Navigate } from 'react-router-dom';

/**
 * Private Route Component
 * 
 * Protects routes that require authentication by redirecting
 * unauthenticated users to the login page.
 */
const PrivateRoute = ({ children }) => {
  // Check if user is authenticated
  const isAuthenticated = localStorage.getItem('token') !== null;
  
  // If not authenticated, redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  // If authenticated, render the protected component
  return children;
};

export default PrivateRoute;