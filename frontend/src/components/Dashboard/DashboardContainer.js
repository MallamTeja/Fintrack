import React, { useState, useEffect, useRef } from 'react';
import DashboardConnectionHandler from '../../utils/dashboardConnectionHandler';
import DashboardHeader from './DashboardHeader';
import DashboardContent from './DashboardContent';
import ConnectionStatus from '../common/ConnectionStatus';

/**
 * Dashboard Container Component
 * 
 * This component manages the state and real-time connections for the dashboard.
 * It coordinates data updates and ensures all child components are updated
 * with the latest information.
 */
const DashboardContainer = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState({
    status: 'disconnected',
    message: 'Initializing connection...',
    timestamp: new Date()
  });
  const [isLoading, setIsLoading] = useState(true);
  const connectionHandler = useRef(null);

  // Initialize connection handler on component mount
  useEffect(() => {
    // Create the connection handler
    connectionHandler.current = new DashboardConnectionHandler(
      process.env.REACT_APP_WS_URL || undefined,
      handleDataUpdate,
      handleStatusChange
    );
    
    // Start the connection
    connectionHandler.current.connect();
    
    // Clean up on unmount
    return () => {
      if (connectionHandler.current) {
        connectionHandler.current.disconnect();
      }
    };
  }, []);

  // Handle incoming data updates
  const handleDataUpdate = (data) => {
    setDashboardData(data);
    setIsLoading(false);
  };

  // Handle connection status changes
  const handleStatusChange = (status) => {
    setConnectionStatus(status);
    
    // If we've lost connection, show loading state
    if (['error', 'disconnected'].includes(status.status)) {
      setIsLoading(true);
    }
  };

  // Handle manual refresh request
  const handleRefresh = () => {
    setIsLoading(true);
    if (connectionHandler.current) {
      connectionHandler.current.refreshData();
    }
  };

  return (
    <div className="dashboard-container">
      <DashboardHeader 
        title="Financial Dashboard" 
        onRefresh={handleRefresh}
        lastUpdated={connectionStatus.timestamp}
      />
      
      <ConnectionStatus 
        status={connectionStatus.status} 
        message={connectionStatus.message} 
      />
      
      {isLoading ? (
        <div className="dashboard-loading">
          <div className="spinner"></div>
          <p>Loading dashboard data...</p>
        </div>
      ) : (
        <DashboardContent data={dashboardData} />
      )}
      
      <div className="dashboard-footer">
        <p>Last updated: {connectionStatus.timestamp.toLocaleTimeString()}</p>
        {connectionStatus.status === 'error' && (
          <button 
            className="reconnect-button"
            onClick={() => connectionHandler.current.connect()}
          >
            Reconnect
          </button>
        )}
      </div>
    </div>
  );
};

export default DashboardContainer;