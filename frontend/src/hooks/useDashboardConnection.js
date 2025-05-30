/**
 * Dashboard Connection Hook
 * 
 * This custom React hook encapsulates the WebSocket connection logic
 * for dashboard components, providing real-time data synchronization.
 */
import { useState, useEffect, useCallback } from 'react';

export const useDashboardConnection = (wsUrl = 'ws://localhost:5000/dashboard') => {
  const [dashboardData, setDashboardData] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState({
    status: 'disconnected',
    message: 'Initializing connection...',
    timestamp: new Date()
  });
  const [isLoading, setIsLoading] = useState(true);
  const [socket, setSocket] = useState(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [syncInterval, setSyncInterval] = useState(null);

  const MAX_RECONNECT_ATTEMPTS = 10;
  const RECONNECT_DELAY = 1000; // Start with 1 second

  // Update connection status and notify UI
  const updateStatus = useCallback((status, message, timestamp = null) => {
    const statusUpdate = {
      status,
      message,
      timestamp: timestamp || new Date()
    };
    
    setConnectionStatus(statusUpdate);
    
    // If we've lost connection, show loading state
    if (['error', 'disconnected'].includes(status)) {
      setIsLoading(true);
    }
  }, []);

  // Handle incoming messages from WebSocket
  const handleMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.data);
      const timestamp = new Date();
      
      if (data.type === 'error') {
        updateStatus('warning', `Service warning: ${data.message}`, timestamp);
      } else {
        updateStatus('connected', 'Data synchronized', timestamp);
        setDashboardData(data);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      updateStatus('warning', 'Received invalid data format');
    }
  }, [updateStatus]);

  // Stop the data synchronization interval
  const stopDataSync = useCallback(() => {
    if (syncInterval) {
      clearInterval(syncInterval);
      setSyncInterval(null);
    }
  }, [syncInterval]);

  // Start regular data synchronization
  const startDataSync = useCallback(() => {
    stopDataSync();
    
    // Set up a new interval to request updates every second
    const interval = setInterval(() => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ 
          type: 'sync_request',
          timestamp: new Date().toISOString()
        }));
      }
    }, 1000); // Update every second
    
    setSyncInterval(interval);
  }, [socket, stopDataSync]);

  // Request initial data after connection
  const requestInitialData = useCallback(() => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'initial_data_request' }));
    }
  }, [socket]);

  // Attempt to reconnect with exponential backoff
  const attemptReconnect = useCallback(() => {
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      const delay = Math.min(30000, RECONNECT_DELAY * Math.pow(1.5, reconnectAttempts));
      const newAttempts = reconnectAttempts + 1;
      setReconnectAttempts(newAttempts);
      
      updateStatus('reconnecting', `Reconnecting (attempt ${newAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
      
      setTimeout(() => {
        connect();
      }, delay);
    } else {
      updateStatus('error', 'Failed to connect after multiple attempts. Please reload the page.');
    }
  }, [reconnectAttempts, updateStatus]);

  // Initialize the WebSocket connection
  const connect = useCallback(() => {
    updateStatus('connecting', 'Connecting to dashboard service...');
    
    // Close existing socket if any
    if (socket) {
      socket.close();
    }
    
    try {
      const newSocket = new WebSocket(wsUrl);
      setSocket(newSocket);
      
      newSocket.onopen = () => {
        setReconnectAttempts(0);
        updateStatus('connected', 'Connected to dashboard service');
        requestInitialData();
        startDataSync();
      };
      
      newSocket.onmessage = handleMessage;
      
      newSocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        updateStatus('error', 'Connection error occurred');
      };
      
      newSocket.onclose = (event) => {
        stopDataSync();
        
        if (event.wasClean) {
          updateStatus('disconnected', `Connection closed: ${event.reason}`);
        } else {
          updateStatus('error', 'Connection lost unexpectedly');
          attemptReconnect();
        }
      };
    } catch (error) {
      updateStatus('error', `Failed to connect: ${error.message}`);
      attemptReconnect();
    }
  }, [
    wsUrl, 
    socket, 
    updateStatus, 
    requestInitialData, 
    startDataSync, 
    handleMessage, 
    stopDataSync, 
    attemptReconnect
  ]);

  // Disconnect the WebSocket
  const disconnect = useCallback(() => {
    stopDataSync();
    
    if (socket) {
      socket.close(1000, 'User initiated disconnect');
      setSocket(null);
    }
    
    updateStatus('disconnected', 'Disconnected from service');
  }, [socket, stopDataSync, updateStatus]);

  // Manually request data refresh
  const refreshData = useCallback(() => {
    setIsLoading(true);
    
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ 
        type: 'force_refresh',
        timestamp: new Date().toISOString()
      }));
      updateStatus('refreshing', 'Manually refreshing data...');
    } else {
      updateStatus('error', 'Cannot refresh: not connected');
      connect(); // Try to connect if not already connected
    }
  }, [socket, connect, updateStatus]);

  // Connect on initial mount
  useEffect(() => {
    connect();
    
    // Clean up on unmount
    return () => {
      stopDataSync();
      if (socket) {
        socket.close(1000, 'Component unmounted');
      }
    };
  }, []);

  return {
    dashboardData,
    connectionStatus,
    isLoading,
    connect,
    disconnect,
    refreshData
  };
};