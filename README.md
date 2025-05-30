# Fintrack

A modern financial tracking application with a clean, responsive user interface.

## Features

- User Authentication (Login/Register)
- Modern UI with Light/Dark theme support
- Responsive design
- Password strength validation
- Form validation
- Secure API endpoints

## Tech Stack

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express.js
- Database: MongoDB
- Authentication: JWT

## Getting Started

1. Clone the repository:
```bash
git clone https://github.com/YOUR_USERNAME/fintrack.git
cd fintrack
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```
MONGODB_URI=your_mongodb_connection_string
PORT=5000
JWT_SECRET=your_jwt_secret
```

4. Start the application:
```bash
node start-app.js
```

5. Open your browser and navigate to `http://localhost:5000`

## Deployment on Vercel

This project can be deployed on Vercel with the following setup:

- The backend API is deployed as serverless functions from `backend/server.js`.
- The frontend is served as static files from the `frontend/public` directory.
- The `vercel.json` file configures the builds and routes for Vercel.

### Steps to deploy:

1. Set the following environment variables in your Vercel dashboard for the project:
   - `MONGODB_URI`: Your MongoDB connection string.
   - `FRONTEND_URL`: The URL of your deployed frontend (e.g., `https://your-project.vercel.app`).
   - `NODE_ENV`: Set to `production`.
   - `JWT_SECRET`: Your JWT secret key.

2. Deploy the project using either:
   - Vercel CLI:
     ```bash
     vercel
     ```
   - Git integration: Push your code to a Git repository connected to Vercel.

3. Vercel will build and deploy the backend as serverless functions and serve the frontend as static files.

4. After deployment, your API will be accessible under `/api` routes, and the frontend will be served at the root URL.

### Notes:

- The backend server is configured to work as a serverless function and does not listen on a specific port.
- WebSocket support may require additional configuration as serverless functions have limitations.

## Project Structure

```
fintrack/
├── public/           # Static files
│   ├── login.html    # Login page
│   ├── register.html # Registration page
│   └── dashboard.html# Main dashboard
├── config/          # Configuration files
├── models/          # Database models
├── server.js        # Express server
└── package.json     # Project dependencies
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 