# FinTrack Frontend

This is the frontend for the FinTrack personal finance management application.

## Project Structure

```
frontend/
├── index.js                 # Express server entry point
├── package.json             # Project dependencies and scripts
├── routes/
│   └── api.js               # API route handlers
├── public/                  # Static files served by Express
│   ├── css/
│   │   └── styles.css       # Global styles
│   ├── js/
│   │   ├── login.js         # Login page JavaScript
│   │   └── dashboard.js     # Dashboard page JavaScript
│   ├── login.html           # Login page
│   ├── signup.html          # Signup page
│   ├── dashboard.html       # Dashboard page
│   └── not-found.html       # 404 page
└── README.md                # This file
```

## Setup Instructions

1. Install dependencies:
   ```
   npm install
   ```

2. Start the development server:
   ```
   npm run dev
   ```

3. Access the application at http://localhost:3000

## Available Routes

- `/` - Redirects to login
- `/login` - Login page
- `/signup` - Signup page
- `/dashboard` - User dashboard (requires authentication)

## API Endpoints

- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration

## Development Notes

- This frontend server is designed to work with a separate backend API
- Currently using mock authentication for development purposes