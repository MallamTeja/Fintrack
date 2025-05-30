const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI;
console.log('Attempting to connect to:', uri);

async function testConnection() {
    const client = new MongoClient(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });

    try {
        await client.connect();
        console.log('Successfully connected to MongoDB!');
        const dbs = await client.db().admin().listDatabases();
        console.log('Available databases:', dbs.databases.map(db => db.name));
    } catch (err) {
        console.error('Connection error:', err);
    } finally {
        await client.close();
    }
}

testConnection(); 