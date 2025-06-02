# FinTrack – Personal Finance Manager

FinTrack is a full-stack personal finance tracking application built using the MERN stack. It enables users to manage income, expenses, financial insights, and budgeting all from a clean, intuitive interface.

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)

---

## Overview

FinTrack offers a reliable solution for tracking personal finances. It provides a customizable dashboard, transaction management, filter options, categorized records, and data insights. The frontend is built with modern web technologies, while the backend ensures data persistence and secure API handling.

### Live Demo

[View Application](https://fintrack-five-pink.vercel.app)

---

## Features

- Financial overview dashboard
- Add and view income/expenses
- Filter by category, date, and type
- Default and custom transaction categories
- Quick amount input buttons
- Clean dark UI with responsive design
- User authentication (in development)
- AI-powered financial insights (in development)

---

## Folder Structure

```
Fintrack/
├── backend/
│   ├── config/
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   ├── .env
│   ├── server.js
│   ├── test-connection.js
│   └── package.json
├── frontend/
│   ├── index.html
│   ├── dashboard.html
│   ├── login.html
│   ├── script.js
│   ├── login.js
│   ├── auth.js
│   ├── styles.css
│   ├── tailwind.config.js
│   └── package.json
└── README.md
```

---

## Tech Stack

### Frontend

- HTML5
- CSS3
- Tailwind CSS
- JavaScript
- React (planned enhancement)

### Backend

- Node.js
- Express.js
- MongoDB (via Mongoose)

### Deployment

- Frontend: Vercel
- Backend: Local or cloud deployment (e.g., Render, Railway)

---

## Installation and Setup

### Backend

```bash
cd backend
npm install
```

Create a `.env` file in the `backend/` directory with the following:

```
PORT=5000
MONGO_URI=your_mongodb_connection_uri
```

Start the server:

```bash
npm start
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## Libraries and Tools Used

```
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)
```

---

## Author

**Teja Mallam**  
[GitHub Profile](https://github.com/MallamTeja)  
Contact: tejamallam1233@gmail.com

---

## Contributing

Contributions are welcome. To contribute:

1. Fork the repository
2. Create a new branch (`git checkout -b feature-name`)
3. Make your changes
4. Commit and push (`git commit -m "Add feature"` and `git push origin feature-name`)
5. Open a pull request

---

## License

This project is licensed under the MIT License.
