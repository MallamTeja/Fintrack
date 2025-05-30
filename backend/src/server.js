const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from parent directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const connectDB = require('../config/db');

// Initialize express app
const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the frontend
app.use(express.static(path.join(__dirname, '../../frontend/public')));

// Define routes
app.use('/api/users', require('../routes/users'));
app.use('/api/transactions', require('../routes/transactions'));

app.get('/mainpage.html', (req, res) => {
    res.redirect('/api/dashboard'); // Redirect to the dashboard after login
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
