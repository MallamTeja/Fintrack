/**
 * Test Setup
 * Global test configuration and utilities
 */

const mongoose = require('mongoose');

// Use a simpler in-memory test database approach
// Global test setup
beforeAll(async () => {
    // Use a test database name
    const mongoUri = 'mongodb://localhost:27017/fintrack-test';
    
    try {
        await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
    } catch (error) {
        // If MongoDB is not available, skip database tests
        console.warn('MongoDB not available for testing, skipping database tests');
    }
});

// Clean up after each test
afterEach(async () => {
    if (mongoose.connection.readyState === 1) {
        const collections = mongoose.connection.collections;
        for (const key in collections) {
            await collections[key].deleteMany({});
        }
    }
});

// Global test teardown
afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
        await mongoose.connection.dropDatabase();
        await mongoose.connection.close();
    }
});

// Set test timeout
jest.setTimeout(15000);