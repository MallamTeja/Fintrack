# FinTrack Backend API Documentation

## Overview

The FinTrack backend provides a RESTful API for personal finance management. It supports user authentication, transaction management, budgeting, and savings goals tracking.

## Base URL

- Development: `http://localhost:5000/api`
- Production: `https://fintrack-five-pink.vercel.app/api`

## Authentication

All protected endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

## Response Format

All API responses follow this consistent format:

```json
{
  "success": true|false,
  "data": <response_data>,
  "error": {
    "message": "Error description",
    "type": "ErrorType"
  },
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

## Error Codes

- `400` - Bad Request (validation errors, invalid input)
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource not found)
- `409` - Conflict (duplicate resource)
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

---

## Authentication Endpoints

### Register User

**POST** `/auth/register`

Register a new user account.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

**Validation:**
- Name: 2-50 characters, letters and spaces only
- Email: Valid email format
- Password: 6-128 characters, must contain uppercase, lowercase, and number

**Response (201):**
```json
{
  "success": true,
  "token": "jwt_token_here",
  "user": {
    "id": "user_id",
    "name": "John Doe",
    "email": "john@example.com",
    "preferences": {
      "theme": "light",
      "currency": "USD",
      "notifications": true
    }
  }
}
```

### Login User

**POST** `/auth/login`

Authenticate user and receive JWT token.

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

**Response (200):**
```json
{
  "success": true,
  "token": "jwt_token_here",
  "user": {
    "id": "user_id",
    "name": "John Doe",
    "email": "john@example.com",
    "lastLoginTime": "2023-01-01T12:00:00.000Z",
    "preferences": {...}
  }
}
```

### Get Current User

**GET** `/auth/me`

Get current user information.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "user_id",
    "name": "John Doe",
    "email": "john@example.com",
    "preferences": {...}
  }
}
```

### Update User Preferences

**PUT** `/auth/preferences`

Update user preferences.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "theme": "dark",
  "currency": "EUR",
  "notifications": false
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "preferences": {
      "theme": "dark",
      "currency": "EUR",
      "notifications": false
    }
  }
}
```

### Change Password

**PUT** `/auth/change-password`

Change user password.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "currentPassword": "OldPass123",
  "newPassword": "NewPass123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

### Logout

**POST** `/auth/logout`

Logout user (client should discard token).

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## Transaction Endpoints

### Get Transactions

**GET** `/transactions`

Get paginated list of user transactions with optional filtering.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (default: 10, max: 100)
- `type` (optional): Filter by type (`income` or `expense`)
- `category` (optional): Filter by category (partial match)
- `startDate` (optional): Filter by date range start (ISO format)
- `endDate` (optional): Filter by date range end (ISO format)

**Example:** `/transactions?page=1&limit=20&type=expense&category=food`

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "transaction_id",
      "user": "user_id",
      "type": "expense",
      "category": "Food",
      "amount": 25.50,
      "description": "Lunch at restaurant",
      "date": "2023-01-01T12:00:00.000Z",
      "createdAt": "2023-01-01T12:00:00.000Z",
      "updatedAt": "2023-01-01T12:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### Create Transaction

**POST** `/transactions`

Create a new transaction.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "description": "Salary payment",
  "amount": 3000,
  "type": "income",
  "category": "Salary",
  "date": "2023-01-01T12:00:00.000Z"
}
```

**Validation:**
- Description: 1-200 characters
- Amount: Number > 0, max 1,000,000
- Type: Either "income" or "expense"
- Category: 1-50 characters
- Date: Valid ISO date format

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "transaction_id",
    "user": "user_id",
    "description": "Salary payment",
    "amount": 3000,
    "type": "income",
    "category": "Salary",
    "date": "2023-01-01T12:00:00.000Z",
    "createdAt": "2023-01-01T12:00:00.000Z",
    "updatedAt": "2023-01-01T12:00:00.000Z"
  }
}
```

### Get Single Transaction

**GET** `/transactions/:id`

Get a specific transaction by ID.

**Headers:** `Authorization: Bearer <token>`

**Parameters:**
- `id`: MongoDB ObjectId of the transaction

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "transaction_id",
    "user": {...},
    "description": "Salary payment",
    "amount": 3000,
    "type": "income",
    "category": "Salary",
    "date": "2023-01-01T12:00:00.000Z"
  }
}
```

### Update Transaction

**PUT** `/transactions/:id`

Update an existing transaction.

**Headers:** `Authorization: Bearer <token>`

**Parameters:**
- `id`: MongoDB ObjectId of the transaction

**Request Body:** Same as create transaction

**Response (200):**
```json
{
  "success": true,
  "data": {
    // Updated transaction object
  }
}
```

### Delete Transaction

**DELETE** `/transactions/:id`

Delete a transaction.

**Headers:** `Authorization: Bearer <token>`

**Parameters:**
- `id`: MongoDB ObjectId of the transaction

**Response (200):**
```json
{
  "success": true,
  "message": "Transaction deleted successfully"
}
```

### Get Transaction Statistics

**GET** `/transactions/stats/summary`

Get aggregated transaction statistics.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `startDate` (optional): Start date for statistics
- `endDate` (optional): End date for statistics
- `category` (optional): Filter by category

**Response (200):**
```json
{
  "success": true,
  "data": {
    "typeStats": [
      {
        "_id": "income",
        "total": 5000,
        "count": 3,
        "avgAmount": 1666.67
      },
      {
        "_id": "expense",
        "total": 1200,
        "count": 8,
        "avgAmount": 150
      }
    ],
    "categoryStats": [
      {
        "_id": "Food",
        "income": 0,
        "expense": 300,
        "totalTransactions": 5
      }
    ]
  }
}
```

---

## Budget Endpoints

### Get Budgets

**GET** `/budgets`

Get all budgets for the authenticated user.

**Headers:** `Authorization: Bearer <token>`

### Create Budget

**POST** `/budgets`

Create a new budget.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "category": "Food",
  "limit": 500,
  "period": "monthly"
}
```

### Update Budget

**PUT** `/budgets/:id`

Update an existing budget.

### Delete Budget

**DELETE** `/budgets/:id`

Delete a budget.

---

## Savings Endpoints

### Get Savings Goals

**GET** `/savings`

Get all savings goals for the authenticated user.

### Create Savings Goal

**POST** `/savings`

Create a new savings goal.

### Update Savings Goal

**PUT** `/savings/:id`

Update an existing savings goal.

### Delete Savings Goal

**DELETE** `/savings/:id`

Delete a savings goal.

---

## Health Check

### Server Health

**GET** `/health`

Check server status (no authentication required).

**Response (200):**
```json
{
  "success": true,
  "message": "Server is running",
  "timestamp": "2023-01-01T12:00:00.000Z",
  "environment": "development"
}
```

---

## Rate Limiting

- General API endpoints: 100 requests per 15 minutes per IP
- Authentication endpoints: 10 requests per 15 minutes per IP

---

## WebSocket Events

The API supports real-time updates via WebSocket connections:

### Events Sent to Client:
- `transaction_added`: New transaction created
- `transaction_updated`: Transaction modified
- `transaction_deleted`: Transaction removed

### Connection:
- URL: `ws://localhost:5000` (development)
- Authentication: Send JWT token after connection

---

## Security Features

- JWT-based authentication
- Password hashing with bcrypt (salt rounds: 12)
- Input validation and sanitization
- Rate limiting
- CORS protection
- Security headers via Helmet
- Request size limits
- SQL injection prevention via Mongoose ODM

---

## Development

### Running Tests

```bash
npm test                # Run all tests
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Run tests with coverage
```

### Environment Variables

```env
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb://localhost:27017/fintrack
JWT_SECRET=your-secret-key
```

### Error Logging

All errors are logged with timestamps and context information for debugging purposes.