const mongoose = require('mongoose');
const monfdn_uri = require('./config/mongodb');

const testConnection = async () => {
  try {
    await mongoose.connect(monfdn_uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connection successful');
    
    // Test database operations
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Available collections:', collections.map(c => c.name));
    
    await mongoose.connection.close();
    console.log('Connection closed');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
  }
};

testConnection(); 