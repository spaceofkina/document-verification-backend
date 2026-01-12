const express = require('express');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.json());

// Import routes
const apiRoutes = require('./src/routes/api');

// Use API routes
app.use('/api', apiRoutes);

// Basic routes
app.get('/', (req, res) => {
    res.json({
        system: 'Brgy Lajong Document Request System',
        version: '1.0.0',
        api: 'Visit /api',
        features: ['CNN ID Verification', 'OCR Processing', 'Document Generation'],
        status: 'running'
    });
});

// CNN test route
app.get('/cnn-test', async (req, res) => {
    try {
        // Test if CNN service loads
        const cnnService = require('./src/services/cnnService');
        res.json({
            status: 'success',
            message: 'CNN service loaded successfully',
            model: '7-layer TensorFlow.js CNN',
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
        service: 'document-request-system'
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`
    🚀 Server started on port ${PORT}
    📍 Local: http://localhost:${PORT}
    🌐 API: http://localhost:${PORT}/api
    🏥 Health: http://localhost:${PORT}/health
    
    Default admin: adminclient@barangay.com
    Password: brgylajong321_clnt
    `);
});