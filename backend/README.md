# FinTrack Backend

A professional Node.js/Express backend for the FinTrack personal finance management application. Built with security, scalability, and maintainability in mind.

## 🚀 Features

- **Authentication & Authorization**: JWT-based secure authentication
- **Transaction Management**: CRUD operations for financial transactions
- **Budget Tracking**: Budget creation and monitoring
- **Savings Goals**: Personal savings goal management
- **Real-time Updates**: WebSocket support for live data updates
- **Data Analytics**: Transaction statistics and insights
- **Security**: Input validation, rate limiting, password hashing
- **Testing**: Comprehensive unit and integration tests
- **Documentation**: Complete API documentation
- **Error Handling**: Centralized error management
- **Logging**: Structured logging system

## 🛠️ Technology Stack

- **Runtime**: Node.js 14+
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JSON Web Tokens (JWT)
- **Password Security**: bcryptjs with salt rounds
- **Validation**: express-validator
- **Testing**: Jest with supertest
- **WebSockets**: ws library
- **Security**: Helmet, CORS, rate limiting
- **Documentation**: Comprehensive API docs

## 📋 Prerequisites

- Node.js 14.0.0 or higher
- MongoDB 4.4 or higher
- npm or yarn package manager

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/MallamTeja/Fintrack.git
   cd Fintrack/backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment setup**
   Create a `.env` file in the root directory:
   ```env
   NODE_ENV=development
   PORT=5000
   MONGO_URI=mongodb://localhost:27017/fintrack
   JWT_SECRET=your-super-secure-jwt-secret-key-here
   ```

4. **Database setup**
   Ensure MongoDB is running locally or use MongoDB Atlas for cloud database.

## 🚀 Running the Application

### Development Mode
```bash
npm run dev
```
Runs the server with nodemon for auto-restart on file changes.

### Production Mode
```bash
npm start
```
Runs the server in production mode.

### Available Scripts
```bash
npm run dev          # Development server with auto-reload
npm start           # Production server
npm test            # Run test suite
npm run test:watch  # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
```

## 🧪 Testing

The application includes comprehensive tests for models, middleware, routes, and utilities.

### Running Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Test Structure
```
tests/
├── unit/                 # Unit tests
│   ├── models/          # Model tests
│   ├── middleware/      # Middleware tests
│   └── utils/           # Utility function tests
├── integration/         # Integration tests
└── fixtures/           # Test data fixtures
```

## 📁 Project Structure

```
backend/
├── config/             # Configuration files
│   ├── default.json   # Default configuration
│   ├── test.json      # Test environment config
│   └── index.js       # Configuration management
├── middleware/         # Express middleware
│   └── auth.js        # Authentication middleware
├── models/            # Mongoose models
│   ├── User.js        # User model
│   ├── Transaction.js # Transaction model
│   ├── Budget.js      # Budget model
│   └── SavingsGoal.js # Savings goal model
├── routes/            # Express routes
│   ├── auth.js        # Authentication routes
│   ├── transactions.js # Transaction routes
│   ├── budgets.js     # Budget routes
│   └── savings.js     # Savings routes
├── utils/             # Utility functions
│   ├── errorHandler.js # Error handling utilities
│   ├── validation.js  # Input validation utilities
│   └── logger.js      # Logging utilities
├── tests/             # Test files
├── server.js          # Main server file
├── websocketManager.js # WebSocket management
└── package.json       # Dependencies and scripts
```

## 🔐 Security Features

### Authentication & Authorization
- JWT-based stateless authentication
- Secure password hashing with bcrypt (12 salt rounds)
- Token expiration and validation
- Protected route middleware

### Input Security
- Request validation with express-validator
- Input sanitization to prevent XSS attacks
- MongoDB injection prevention
- Request size limits

### Rate Limiting
- Global rate limiting: 100 requests/15 minutes
- Auth endpoint limiting: 10 requests/15 minutes
- IP-based tracking

### Security Headers
- Helmet.js for security headers
- CORS configuration
- Content Security Policy

## 📊 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/preferences` - Update preferences
- `PUT /api/auth/change-password` - Change password
- `POST /api/auth/logout` - Logout

### Transactions
- `GET /api/transactions` - Get transactions (with pagination/filtering)
- `POST /api/transactions` - Create transaction
- `GET /api/transactions/:id` - Get single transaction
- `PUT /api/transactions/:id` - Update transaction
- `DELETE /api/transactions/:id` - Delete transaction
- `GET /api/transactions/stats/summary` - Get statistics

### Budgets
- `GET /api/budgets` - Get budgets
- `POST /api/budgets` - Create budget
- `PUT /api/budgets/:id` - Update budget
- `DELETE /api/budgets/:id` - Delete budget

### Savings Goals
- `GET /api/savings` - Get savings goals
- `POST /api/savings` - Create savings goal
- `PUT /api/savings/:id` - Update savings goal
- `DELETE /api/savings/:id` - Delete savings goal

For detailed API documentation, see [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)

## 🔌 WebSocket Support

Real-time updates for:
- Transaction creation/updates/deletion
- Budget modifications
- Savings goal progress

### WebSocket Events
```javascript
// Client receives these events
{
  type: 'transaction_added',
  payload: { /* transaction data */ }
}

{
  type: 'transaction_updated', 
  payload: { /* updated transaction */ }
}

{
  type: 'transaction_deleted',
  payload: { id: 'transaction_id' }
}
```

## 🚦 Error Handling

Centralized error handling with:
- Custom error classes
- Consistent error response format
- Detailed error logging
- Environment-specific error details

### Error Response Format
```json
{
  "success": false,
  "error": {
    "message": "Descriptive error message",
    "type": "ErrorType"
  }
}
```

## 📈 Monitoring & Logging

### Logging Levels
- `INFO`: General information
- `WARN`: Warning messages
- `ERROR`: Error events
- `DEBUG`: Debug information (development only)

### Health Check
`GET /api/health` - Returns server status and environment info

## 🔧 Configuration

Configuration is managed through JSON files in the `config/` directory:

- `default.json` - Default configuration
- `test.json` - Test environment overrides
- Environment variables override JSON config

### Key Configuration Options
```json
{
  "jwtSecret": "your-jwt-secret",
  "mongoURI": "mongodb://localhost:27017/fintrack",
  "port": 5000,
  "websocket": {
    "heartbeatInterval": 30000,
    "reconnectInterval": 5000
  }
}
```

## 🚀 Deployment

### Environment Variables
Set these in production:
```env
NODE_ENV=production
PORT=5000
MONGO_URI=your-production-mongodb-uri
JWT_SECRET=your-strong-production-secret
```

### Docker Support
```dockerfile
# Example Dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes with proper tests
4. Ensure all tests pass: `npm test`
5. Commit your changes: `git commit -m 'Add feature'`
6. Push to the branch: `git push origin feature-name`
7. Open a pull request

### Code Standards
- Follow ESLint configuration
- Write tests for new features
- Update documentation for API changes
- Use semantic commit messages

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.

## 👤 Author

**Teja Mallam**
- GitHub: [@MallamTeja](https://github.com/MallamTeja)
- LinkedIn: [tejamallam](https://www.linkedin.com/in/tejamallam)
- Email: tejamallam1233@gmail.com

## 🙏 Acknowledgments

- Express.js team for the excellent framework
- Mongoose team for the ODM
- Jest team for the testing framework
- All contributors and the open source community