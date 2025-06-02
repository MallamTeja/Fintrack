/**
 * Database Connection Module
 * This module handles the MongoDB connection setup, configuration, and error handling
 * for the FinTrack application.
 */

const mongoose = require('mongoose');
const config = require('./config/default.json');

/**
 * Establishes connection to MongoDB database
 * Configures connection options and sets up event handlers
 * @returns {Promise<void>}
 */
const connectDB = async () => {
    try {
        // Get MongoDB URI from environment variables or config file
        const mongoURI = process.env.MONGODB_URI || config.mongoURI;
        console.log('MongoDB URI:', mongoURI);

        if (!mongoURI) {
            throw new Error('MongoDB URI is not defined in environment variables or config file');
        }

        // Connect to MongoDB with optimized settings
        await mongoose.connect(mongoURI, {
            useNewUrlParser: true,      // Use new URL string parser
            useUnifiedTopology: true,   // Use new Server Discovery and Monitoring engine
            autoIndex: true,            // Build indexes automatically
            serverSelectionTimeoutMS: 5000,  // Timeout for server selection
            socketTimeoutMS: 45000,     // Socket timeout
            family: 4                   // Use IPv4, skip trying IPv6
        });

        // Log successful connection details
        console.log('MongoDB Connected Successfully');
        console.log('Connected to database:', mongoose.connection.name);
        console.log('Collections:', Object.keys(mongoose.connection.collections));

        /**
         * Error Event Handler
         * Logs any errors that occur during the database connection
         */
        mongoose.connection.on('error', (err) => {
            console.error('MongoDB connection error:', err);
        });

        /**
         * Disconnection Event Handler
         * Logs when the database connection is lost
         */
        mongoose.connection.on('disconnected', () => {
            console.log('MongoDB disconnected');
        });

        /**
         * Reconnection Event Handler
         * Logs when the database connection is re-established
         */
        mongoose.connection.on('reconnected', () => {
            console.log('MongoDB reconnected');
        });

        /**
         * Process Termination Handler
         * Gracefully closes the database connection when the application is terminated
         */
        process.on('SIGINT', async () => {
            try {
                await mongoose.connection.close();
                console.log('MongoDB connection closed through app termination');
                process.exit(0);
            } catch (err) {
                console.error('Error closing MongoDB connection:', err);
                process.exit(1);
            }
        });

    } catch (err) {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    }
};

module.exports = { connectDB };
