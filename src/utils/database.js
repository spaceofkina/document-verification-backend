const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        
        // Create indexes
        await mongoose.connection.collection('documentrequests').createIndex({ requestId: 1 }, { unique: true });
        await mongoose.connection.collection('documentrequests').createIndex({ trackingCode: 1 }, { unique: true });
        await mongoose.connection.collection('users').createIndex({ email: 1 }, { unique: true });
        
    } catch (error) {
        console.error(`Error connecting to MongoDB: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;