// Add this to your login route handler for debugging
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log(`Login attempt for email: ${email}`);
    
    // Find user
    const user = await User.findOne({ email });
    
    if (!user) {
      console.log(`User not found: ${email}`);
      return res.status(400).json({ msg: 'Invalid credentials' });
    }
    
    console.log('User found in database');
    console.log('Stored hashed password:', user.password);
    console.log('Submitted password:', password);
    
    // Compare passwords
    const isMatch = await user.comparePassword(password);
    console.log('Password comparison result:', isMatch);
    
    if (!isMatch) {
      console.log(`Password mismatch for user: ${email}`);
      return res.status(400).json({ msg: 'Invalid credentials' });
    }
    
    // Create and return JWT token...
    // Rest of your login code
    
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});