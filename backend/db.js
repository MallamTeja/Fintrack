const mongoose = require('mongoose');
const config = require('./config/default.json');

const connectDB = async () => {
    try {
        const mongoURI = process.env.MONGODB_URI || config.mongoURI;
        console.log('MongoDB URI:', mongoURI);

        if (!mongoURI) {
            throw new Error('MongoDB URI is not defined in environment variables or config file');
        }

        await mongoose.connect(mongoURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            autoIndex: true,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            family: 4
        });

        console.log('MongoDB Connected Successfully');
        console.log('Connected to database:', mongoose.connection.name);
        console.log('Collections:', Object.keys(mongoose.connection.collections));

        // Handle connection events
        mongoose.connection.on('error', (err) => {
            console.error('MongoDB connection error:', err);
        });

        mongoose.connection.on('disconnected', () => {
            console.log('MongoDB disconnected');
        });

        mongoose.connection.on('reconnected', () => {
            console.log('MongoDB reconnected');
        });

        // Handle process termination
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
