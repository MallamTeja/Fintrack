# FinTrack - Personal Finance Manager

A modern web application for managing personal finances, built with React, Node.js, and MongoDB.

## Features

- User authentication and authorization
- Dashboard with financial overview
- Transaction management
- Budget tracking
- Financial goals
- Reports and analytics
- Real-time notifications

## Prerequisites

- Node.js (v14 or higher)
- MongoDB
- npm or yarn

## Project Structure

```
fintrack/
├── frontend/          # React frontend application
├── backend/           # Node.js backend server
└── README.md
```

## Setup Instructions

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the backend directory with the following variables:
   ```
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/fintrack
   JWT_SECRET=your_jwt_secret
   ```

4. Start the backend server:
   ```bash
   npm run dev
   ```

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the frontend directory with the following variables:
   ```
   REACT_APP_API_URL=http://localhost:5000
   ```

4. Start the frontend development server:
   ```bash
   npm start
   ```

## Running the Application

1. Start MongoDB service
2. Start the backend server (from backend directory):
   ```bash
   npm run dev
   ```
3. Start the frontend development server (from frontend directory):
   ```bash
   npm start
   ```

The application will be available at `http://localhost:3000`

## Testing

### Backend Tests
```bash
cd backend
npm test
```

### Frontend Tests
```bash
cd frontend
npm test
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is licensed under the MIT License.
