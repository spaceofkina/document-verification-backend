const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.json());

// ===== DATABASE CONNECTION =====
const connectDB = async () => {
    try {
        console.log('🔗 Attempting to connect to MongoDB...');
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        
        // Create default admin and staff accounts
        const User = require('./src/models/User');
        await User.createBrgyLajongAdmin();
        await User.createBrgyLajongStaff();
        
    } catch (error) {
        console.error(`❌ MongoDB Connection Error: ${error.message}`);
        console.log('⚠️  Authentication may not work without database connection');
    }
};

// Call connectDB
connectDB();

// Import routes
const apiRoutes = require('./src/routes/api');
const authRoutes = require('./src/routes/authRoutes');
const userRoutes = require('./src/routes/userRoutes');
const documentRoutes = require('./src/routes/documentRoutes'); // ADD THIS
const notificationRoutes = require('./src/routes/notificationRoutes'); // ADD THIS

// Use API routes
app.use('/api', apiRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/documents', documentRoutes); // ADD THIS
app.use('/api/notifications', notificationRoutes); // ADD THIS

// Basic routes
app.get('/', (req, res) => {
    res.json({
        system: 'Brgy Lajong Document Request System',
        version: '2.0.0',
        api: 'Visit /api',
        features: ['CNN ID Verification', 'OCR Processing', 'Document Generation', 'Document Request Management'],
        status: 'running'
    });
});

// CNN test route
app.get('/cnn-test', async (req, res) => {
    try {
        const cnnService = require('./src/services/cnnService');
        res.json({
            status: 'success',
            message: 'CNN service loaded successfully',
            model: 'Python TensorFlow CNN',
            idTypes: cnnService.idTypes
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'error',
            message: 'CNN service error',
            error: error.message 
        });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'document-request-system',
        features: {
            authentication: true,
            cnn: true,
            ocr: true,
            document_requests: true,
            database: true
        }
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`
    🚀 Server started on port ${PORT}
    📍 Local: http://localhost:${PORT}
    🌐 API: http://localhost:${PORT}/api
    🏥 Health: http://localhost:${PORT}/health
    
    📋 Available Endpoints:
    🔐 Auth: /api/auth/*
    👤 Users: /api/users/*
    📄 Documents: /api/documents/*
    🤖 AI Services: /api/* (CNN/OCR)
    
    Default admin: adminclient@barangay.com
    Password: brgylajong321_clnt
    `);
});