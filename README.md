# 🚀 FinTrack - Modern Financial Management System

<div align="center">

![FinTrack Logo](https://img.shields.io/badge/FinTrack-Financial%20Management-blue)
![Version](https://img.shields.io/badge/version-1.0.0-green)
![License](https://img.shields.io/badge/license-MIT-blue)

A modern, real-time financial management system built with Node.js and React.

[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![WebSocket](https://img.shields.io/badge/WebSocket-000000?style=for-the-badge&logo=websocket&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)

</div>

## 📋 Table of Contents
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [API Documentation](#-api-documentation)
- [Contributing](#-contributing)
- [License](#-license)

## ✨ Features

- 💰 Real-time transaction tracking
- 📊 Budget management with visual analytics
- 🎯 Savings goals tracking
- 🔐 Secure authentication with JWT
- 📱 Responsive design for all devices
- 🔄 Real-time updates via WebSocket
- 📈 Financial insights and reports
- 🌙 Dark/Light theme support

## 🛠 Tech Stack

### Backend
| Technology | Version | Description |
|------------|---------|-------------|
| ![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white) | 16.x | Runtime environment |
| ![Express](https://img.shields.io/badge/Express-000000?style=flat-square&logo=express&logoColor=white) | 4.x | Web framework |
| ![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=flat-square&logo=mongodb&logoColor=white) | 5.x | Database |
| ![Mongoose](https://img.shields.io/badge/Mongoose-880000?style=flat-square&logo=mongodb&logoColor=white) | 6.x | MongoDB ODM |
| ![WebSocket](https://img.shields.io/badge/WebSocket-000000?style=flat-square&logo=websocket&logoColor=white) | 8.x | Real-time communication |
| ![JWT](https://img.shields.io/badge/JWT-000000?style=flat-square&logo=JSON%20web%20tokens&logoColor=white) | 8.x | Authentication |
| ![Bcrypt](https://img.shields.io/badge/Bcrypt-000000?style=flat-square&logo=bcrypt&logoColor=white) | 5.x | Password hashing |

### Frontend
| Technology | Version | Description |
|------------|---------|-------------|
| ![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB) | 18.x | UI library |
| ![Redux](https://img.shields.io/badge/Redux-593D88?style=flat-square&logo=redux&logoColor=white) | 4.x | State management |
| ![Material-UI](https://img.shields.io/badge/Material--UI-0081CB?style=flat-square&logo=material-ui&logoColor=white) | 5.x | UI components |
| ![Chart.js](https://img.shields.io/badge/Chart.js-FF6384?style=flat-square&logo=chartdotjs&logoColor=white) | 3.x | Data visualization |
| ![Axios](https://img.shields.io/badge/Axios-000000?style=flat-square&logo=axios&logoColor=white) | 0.27.x | HTTP client |

## 🚀 Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/fintrack.git
cd fintrack
```

2. Install backend dependencies:
```bash
cd backend
npm install
```

3. Install frontend dependencies:
```bash
cd ../frontend
npm install
```

4. Create a `.env` file in the backend directory:
```env
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
PORT=5000
NODE_ENV=development
```

## ⚙️ Configuration

### Backend Configuration
The backend uses the following environment variables:
- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: Secret key for JWT token generation
- `PORT`: Server port (default: 5000)
- `NODE_ENV`: Environment (development/production)

### Frontend Configuration
Create a `.env` file in the frontend directory:
```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_WS_URL=ws://localhost:5000
```

## 🎮 Usage

1. Start the backend server:
```bash
cd backend
npm run dev
```

2. Start the frontend development server:
```bash
cd frontend
npm start
```

3. Access the application at `http://localhost:3000`

## 📚 API Documentation

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Transactions
- `GET /api/transactions` - Get all transactions
- `POST /api/transactions` - Create transaction
- `PATCH /api/transactions/:id` - Update transaction
- `DELETE /api/transactions/:id` - Delete transaction

### Budgets
- `GET /api/budgets` - Get all budgets
- `POST /api/budgets` - Create budget
- `PATCH /api/budgets/:id` - Update budget
- `DELETE /api/budgets/:id` - Delete budget

### Savings Goals
- `GET /api/savings-goals` - Get all savings goals
- `POST /api/savings-goals` - Create savings goal
- `PATCH /api/savings-goals/:id` - Update savings goal
- `DELETE /api/savings-goals/:id` - Delete savings goal

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Authors

- Your Name - Initial work - [YourGitHub](https://github.com/yourusername)

## 🙏 Acknowledgments

- [Node.js](https://nodejs.org/)
- [React](https://reactjs.org/)
- [MongoDB](https://www.mongodb.com/)
- [Express.js](https://expressjs.com/)
- [Material-UI](https://mui.com/)
- [Chart.js](https://www.chartjs.org/)

---

<div align="center">
Made with ❤️ by Your Name
</div>
