const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = "mongodb+srv://tejamallam:9392256662@finathondatabase.4w5rhcy.mongodb.net/?retryWrites=true&w=majority&appName=Finathondatabase";
console.log('Attempting to connect to MongoDB...');

async function testConnection() {
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('Successfully connected to MongoDB!');
        const db = client.db('fintrack'); // specify a database name
        console.log('Connected to database');
    } catch (err) {
        console.error('Connection error:', err);
    } finally {
        await client.close();
    }
}

testConnection(); 