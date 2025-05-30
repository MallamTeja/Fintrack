# FinTrack Developer Onboarding Guide

## 📱 Application Overview

FinTrack is a personal finance management web application built with a MERN-based stack, featuring real-time updates via WebSockets, secure JWT authentication, and a custom state management system.

This guide provides comprehensive documentation of the architecture, real-time capabilities, testing framework, and outstanding tasks to help new developers or AI assistants quickly understand the system.

## 🏗️ System Architecture

### Backend Architecture (Node.js + Express + MongoDB)

#### WebSocket Controller (`wsController.js`)

- Initializes and manages all WebSocket client connections
- Performs JWT authentication immediately upon client connection
- Supports real-time events: `transaction:added`, `transaction:updated`, `transaction:deleted`
- Maintains authenticated client list for secure broadcasting
- Handles reconnection and connection status tracking

```javascript
// Example WebSocket initialization from server.js
const { initializeWebSocketServer } = require('./wsController');

// Initialize WebSocket server after HTTP server is running
const wss = initializeWebSocketServer(server);
            
// Store WebSocket server instance for use in routes
app.set('wss', wss);
```

#### JWT Authentication Flow

- Every WebSocket message includes a token for verification
- Server-side verification using `jsonwebtoken` library
- Unauthorized clients are rejected with appropriate error messages
- Authenticated clients receive confirmation and can participate in real-time updates

```javascript
// Example authentication handling in wsController.js
function handleAuthentication(ws, token) {
  try {
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Set authenticated state and user ID
    ws.authenticated = true;
    ws.userId = decoded.userId || decoded.id;
    
    // Send authenticated message
    ws.send(JSON.stringify({ 
      type: 'authenticated', 
      payload: { userId: ws.userId } 
    }));
  } catch (error) {
    // Send unauthorized message
    ws.send(JSON.stringify({ 
      type: 'unauthorized', 
      payload: { message: 'Invalid token' } 
    }));
  }
}
```

#### Express Routes

- Transaction routes (`/api/transactions`) perform CRUD operations on MongoDB
- Upon successful database updates, WebSocket broadcast functions are triggered
- Broadcasts ensure all connected clients receive real-time updates

```javascript
// Example from transaction.js route handler
// After saving a transaction to the database:
const wss = req.app.get('wss');
if (wss) {
  broadcastToAuthenticated(wss, {
    type: 'transaction:added',
    payload: savedTransaction
  });
  broadcastToUser(wss, req.user._id.toString(), {
    type: 'transaction:added',
    payload: savedTransaction
  });
}
```

### Frontend Architecture (Vanilla JS + Custom State Manager)

#### WebSocketService Module

- Connects to `ws://localhost:5000` and handles reconnection logic
- Performs authentication after socket connection is established
- Emits messages in the format: `{ type, token, payload }`
- Handles server responses and dispatches events to the state manager
- Queues messages during offline periods for later processing

```javascript
// Example authentication in webSocketService.js
authenticate() {
  if (this.isConnected() && this.token) {
    // Send authentication message in the format expected by the backend
    this.socket.send(JSON.stringify({
      type: 'authenticate',
      token: this.token,
      payload: {}
    }));
    
    this.log('Authentication request sent');
  }
}
```

#### Message Format

All WebSocket messages follow a consistent format:

```javascript
{
  type: "event:name",     // The type of message/event
  token: "jwt-token",     // JWT token for authentication (when sending to server)
  payload: {              // The actual data being transmitted
    // Event-specific data
  }
}
```

#### Real-Time Testing Module

- `realTimeTest.js` provides comprehensive testing tools
- Methods include:
  - `testAPI()`: Tests adding transactions via API
  - `testWebSocket()`: Tests WebSocket event reception
  - `testStore()`: Checks store updates
  - `testUI()`: Verifies UI reacts to store changes
  - `testFullFlow()`: Tests the complete flow from API → UI
  - `testMultiTab()`: Tests cross-tab WebSocket synchronization

```javascript
// Example usage of testing tools
// In browser console:
realTimeTest.testAPI();         // Test adding transaction via API
realTimeTest.testWebSocket();   // Confirm real-time event received
realTimeTest.testFullFlow();    // Test full API → WebSocket → Store → UI flow
```

#### Test Report Generator

- Runs end-to-end tests for real-time functionality
- Generates detailed pass/fail reports
- Supports UI display and JSON export of test results
- Helps validate the complete transaction flow

#### State Management

- Custom store implementation with publish/subscribe pattern
- UI components subscribe to relevant state changes
- Store gets updated from WebSocket events or API responses
- Provides a consistent interface for state mutations

```javascript
// Example state subscription in a component
store.subscribe('transactions:updated', (transactions) => {
  // Update UI with new transaction data
  renderTransactions(transactions);
});
```

#### UI Components

- Dynamic connection status indicator shows:
  - "Connecting": Initial WebSocket connection attempt
  - "Connected": WebSocket connected but not authenticated
  - "Authenticated": Fully authenticated and ready for real-time updates
  - "Disconnected": Connection lost
  - "Error": Connection or authentication error
- TailwindCSS used for styling (currently via CDN)

## ✅ System Capabilities

- **Secure Communication**: WebSocket connections with token-based authentication
- **Real-Time Sync**: Transaction updates sync across multiple browser tabs
- **Dynamic Updates**: UI updates without page refresh when data changes
- **Testing Framework**: Comprehensive tools for testing real-time functionality
- **Status Monitoring**: Visual indicators for connection status
- **Offline Support**: (Partial) Message queuing for offline scenarios

## 🔄 Real-Time Data Flow

The complete flow for real-time updates follows this pattern:

1. **User Action**: User adds/updates/deletes a transaction in the UI
2. **API Call**: Frontend makes a secure API call to the backend
3. **Database Update**: Backend updates the MongoDB database
4. **WebSocket Broadcast**: Backend broadcasts the change via WebSocket
5. **Client Reception**: All connected clients receive the WebSocket message
6. **State Update**: Each client updates its local state store
7. **UI Update**: UI components subscribed to the state are automatically updated

## 🛠️ Outstanding Tasks

1. **Offline Queue Processing**
   - Complete implementation of queue flushing logic
   - Add conflict resolution for operations performed while offline

2. **Extend Real-Time Sync**
   - Add WebSocket support for budget entities
   - Add WebSocket support for savings goals
   - Ensure consistent event naming and payload structure

3. **Connection Resilience**
   - Implement exponential backoff in WebSocket reconnection logic
   - Add more robust error recovery mechanisms

4. **Performance Optimization**
   - Migrate from Tailwind CDN to PostCSS build for production
   - Add performance logging for latency tracking
   - Optimize payload size for WebSocket messages

5. **Error Handling**
   - Improve user feedback during connection issues
   - Add fallback mechanisms for when WebSockets are unavailable

## 🧪 Testing Guidelines

1. **API Testing**
   ```javascript
   realTimeTest.testAPI();
   ```
   Verifies that transactions can be added via the API.

2. **WebSocket Testing**
   ```javascript
   realTimeTest.testWebSocket();
   ```
   Confirms that WebSocket events are properly received.

3. **Full Flow Testing**
   ```javascript
   realTimeTest.testFullFlow();
   ```
   Tests the complete flow from API to UI updates.

4. **Multi-Tab Testing**
   ```javascript
   // In tab 1
   realTimeTest.testMultiTab();
   
   // In tab 2 (after opening a second browser tab)
   realTimeTest.testMultiTab();
   ```
   Verifies that changes sync across multiple browser tabs.

5. **Comprehensive Report**
   ```javascript
   testReport.runAllTests();
   testReport.displayReport();
   ```
   Runs all tests and generates a visual report.

## 📚 Key Files and Directories

- **Backend**
  - `wsController.js`: WebSocket server implementation
  - `server.js`: Main Express server with WebSocket initialization
  - `routes/transaction.js`: API routes with WebSocket broadcasting

- **Frontend**
  - `js/services/webSocketService.js`: WebSocket client implementation
  - `js/state/stateManager.js`: Custom state management
  - `js/utils/realTimeTest.js`: Testing utilities
  - `js/utils/testReportGenerator.js`: Test reporting tools

## 🔒 Security Considerations

- JWT tokens should have appropriate expiration times
- WebSocket messages should be validated on both client and server
- Consider implementing rate limiting for WebSocket messages
- Ensure proper error handling to prevent information leakage

---

This guide serves as a comprehensive reference for the FinTrack application's real-time architecture. For questions or assistance, please contact the development team or refer to the codebase directly.
