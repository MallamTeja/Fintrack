const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const { connectDB } = require('./db');

// Load environment variables
dotenv.config();

// Create test user
async function seedDatabase() {
    try {
        // Connect to MongoDB
        await connectDB();
        console.log('Connected to MongoDB for seeding');

        // Check if test user already exists
        const existingUser = await User.findOne({ email: 'test@example.com' });
        
        if (existingUser) {
            console.log('Test user already exists');
        } else {
            // Create test user
            const testUser = new User({
                name: 'Test User',
                email: 'test@example.com',
                password: 'password123'
            });
            
            await testUser.save();
            console.log('Test user created successfully');
        }

        // Disconnect from MongoDB
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
        
        process.exit(0);
    } catch (error) {
        console.error('Error seeding database:', error);
        process.exit(1);
    }
}

// Run the seeding function
seedDatabase();
