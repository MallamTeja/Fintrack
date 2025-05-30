const express = require('express');
const router = express.Router();

// Mock authentication for testing
// In a real app, this would make requests to your backend
router.post('/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  // For demo purposes only - NEVER do this in a real app!
  // This is just to get your frontend working
  if (email === 'demo@example.com' && password === 'password') {
    // In a real app, you would:
    // 1. Validate the credentials against your database
    // 2. Generate a proper JWT token
    // 3. Return user details
    res.json({
      success: true,
      token: 'sample-token-12345',
      user: {
        id: 1,
        name: 'Demo User',
        email: 'demo@example.com'
      }
    });
  } else {
    res.status(401).json({
      success: false,
      message: 'Invalid email or password'
    });
  }
});

// Register route
router.post('/auth/register', (req, res) => {
  const { name, email, password } = req.body;
  
  // Validate inputs
  if (!name || !email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Please provide all required fields'
    });
  }
  
  // In a real app, you would:
  // 1. Check if the email already exists
  // 2. Hash the password
  // 3. Save the user in the database
  
  // For demo purposes:
  res.status(201).json({
    success: true,
    message: 'Account created successfully',
    user: {
      id: 2, // Mock ID
      name,
      email
    }
  });
});

module.exports = router;