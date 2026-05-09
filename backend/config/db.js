/**
 * config/db.js
 * ============================================================
 * MongoDB Database Connection Configuration
 * 
 * This module handles connecting to MongoDB Atlas (cloud database).
 * We use Mongoose as our ODM (Object Data Mapper) - it lets us
 * define schemas and interact with MongoDB using JavaScript objects.
 * 
 * WHY MONGODB ATLAS?
 * - Cloud-hosted, so no local installation needed
 * - Built-in SSL/TLS encryption for data in transit
 * - Automatic backups and high availability
 * - Free tier available for development
 * 
 * HOW TO SET UP ATLAS:
 * 1. Go to https://www.mongodb.com/cloud/atlas
 * 2. Create a free account and cluster
 * 3. Click "Connect" > "Connect your application"
 * 4. Copy the connection string into your .env file
 * ============================================================
 */

const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    /**
     * Mongoose connection options:
     * - useNewUrlParser: Use the new MongoDB connection string parser
     * - useUnifiedTopology: Use the new server discovery and monitoring engine
     * 
     * The URI comes from .env - NEVER hardcode database credentials!
     * MongoDB Atlas URIs already include SSL by default (mongodb+srv://)
     */
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`   Database: ${conn.connection.name}`);
    console.log(`   SSL: Enabled (via MongoDB Atlas SRV connection)\n`);

  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    console.error('\n   Common fixes:');
    console.error('   1. Check your MONGO_URI in .env file');
    console.error('   2. Whitelist your IP in MongoDB Atlas Network Access');
    console.error('   3. Confirm your Atlas username/password are correct\n');
    // Exit the process with failure code - app cannot run without DB
    process.exit(1);
  }
};

module.exports = connectDB;
