const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('../config/db'); // Path to your database connection

// Function to reset all user passwords
async function resetAllPasswords() {
  try {
    const User = mongoose.model('User');
    console.log('Finding all users...');
    const users = await User.find({});
    console.log(`Found ${users.length} users`);

    for (const user of users) {
      // Set new password - could be email address, a default password, or something else
      const newPassword = user.email; // Using email as the new password

      // Hash the password before saving
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      console.log(`Resetting password for user: ${user.email}`);
      user.password = hashedPassword;
      await user.save();
    }

    console.log('All passwords have been reset');
  } catch (error) {
    console.error('Error resetting passwords:', error);
  } finally {
    mongoose.disconnect();
    console.log('Database connection closed');
  }
}

// Function to reset a specific user's password
async function resetPassword(email, newPassword) {
  try {
    const User = require('../models/User');
    const user = await User.findOne({ email });

    if (!user) {
      console.log(`User with email ${email} not found`);
      return false;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedPassword;
    await user.save();

    console.log(`Password reset successful for user: ${email}`);
    return true;
  } catch (error) {
    console.error('Error resetting password:', error);
    return false;
  } finally {
    mongoose.disconnect();
  }
}

// Example usage:
// To reset all passwords:
// resetAllPasswords()
//   .then(() => console.log('All passwords reset complete!'))
//   .catch(err => console.error('Script error:', err));

// To reset a specific user's password:
// const email = 'user@example.com';
// const newPassword = 'your-new-password';
// resetPassword(email, newPassword)
//   .then(() => console.log('Specific user password reset complete!'))
//   .catch(err => console.error('Script error:', err));

module.exports = {
  resetAllPasswords,
  resetPassword,
};
