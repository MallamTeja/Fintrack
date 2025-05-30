# FinTrack State Management System

This state management system provides a centralized, reactive approach to managing application state across your multi-page FinTrack application.

## Core Features

- **Global Singleton Store**: Single source of truth for all application data
- **Event-based Architecture**: Subscribe to state changes and react accordingly
- **Controlled Updates**: All state changes go through the dispatch system
- **Persistence**: Automatic syncing with localStorage and backend API
- **Offline Support**: Fallback mechanisms when API is unavailable
- **Error Handling**: Comprehensive error handling and recovery

## Usage Guide

### Importing the Store

```javascript
// ES Module import (recommended)
import { store } from './state/index.js';

// Alternative: access via global object
const store = window.FinTrackState.store;
```

### Reading State

```javascript
// Get entire state
const state = store.getState();

// Get specific slice of state
const transactions = store.getState('transactions');

// Get nested state with dot notation
const theme = store.getState('ui.theme');
```

### Subscribing to State Changes

```javascript
// Subscribe to specific events
const unsubscribe = store.subscribe('transactions:updated', (transactions) => {
  console.log('Transactions updated:', transactions);
  // Update UI or perform other actions
});

// Subscribe to all events (wildcard)
store.subscribe('*', (event) => {
  console.log(`Event ${event.type} occurred with data:`, event.data);
});

// Unsubscribe when component is destroyed
unsubscribe();
```

### Modifying State

```javascript
// Add a transaction
store.dispatch('transaction:add', {
  description: 'Grocery shopping',
  amount: 45.67,
  type: 'expense',
  category: 'Food',
  date: new Date().toISOString()
});

// Update a transaction
store.dispatch('transaction:update', {
  id: '123',
  data: { amount: 50.00 }
});

// Delete a transaction
store.dispatch('transaction:delete', '123');

// Fetch transactions from API
store.dispatch('transactions:fetch');

// Update UI state
store.dispatch('ui:setTheme', 'dark');
```

## Available Actions

### Transactions
- `transactions:fetch` - Fetch all transactions from API
- `transaction:add` - Add a new transaction
- `transaction:update` - Update an existing transaction
- `transaction:delete` - Delete a transaction

### Savings Goals
- `savingsGoals:fetch` - Fetch all savings goals from API
- `savingsGoal:add` - Add a new savings goal
- `savingsGoal:update` - Update an existing savings goal
- `savingsGoal:delete` - Delete a savings goal

### Budgets
- `budgets:fetch` - Fetch all budgets from API
- `budget:add` - Add a new budget
- `budget:update` - Update an existing budget
- `budget:delete` - Delete a budget

### UI
- `ui:setTheme` - Set the application theme
- `ui:setLoading` - Set loading state for an entity
- `ui:setError` - Set error state for an entity

### User
- `user:login` - Log in a user
- `user:logout` - Log out the current user
- `user:update` - Update user information

## Events

When state changes occur, the following events are emitted:

### Transaction Events
- `transactions:updated` - Transactions list was updated
- `transaction:added` - A transaction was added
- `transaction:updated` - A transaction was updated
- `transaction:deleted` - A transaction was deleted

### Savings Goal Events
- `savingsGoals:updated` - Savings goals list was updated
- `savingsGoal:added` - A savings goal was added
- `savingsGoal:updated` - A savings goal was updated
- `savingsGoal:deleted` - A savings goal was deleted

### Budget Events
- `budgets:updated` - Budgets list was updated
- `budget:added` - A budget was added
- `budget:updated` - A budget was updated
- `budget:deleted` - A budget was deleted

### UI Events
- `ui:themeChanged` - Theme was changed
- `ui:loadingChanged` - Loading state changed
- `ui:errorChanged` - Error state changed

### User Events
- `user:updated` - User information was updated

## Integration with Existing Components

To integrate with existing components, follow these steps:

1. Import the store at the top of your JavaScript file
2. Subscribe to relevant state changes
3. Update your UI in response to state changes
4. Use store.dispatch() instead of direct API calls
5. Unsubscribe when your component is destroyed

## Example Component

See `js/components/transactionList.js` for a complete example of a component using the state management system.
