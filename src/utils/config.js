const path = require('path');

const config = {
    // Server configuration
    server: {
        port: process.env.PORT || 5000,
        env: process.env.NODE_ENV || 'development'
    },
    
    // JWT configuration
    jwt: {
        secret: process.env.JWT_SECRET || 'your_jwt_secret_key',
        expire: process.env.JWT_EXPIRE || '7d'
    },
    
    // File upload configuration
    upload: {
        maxFileSize: 5 * 1024 * 1024, // 5MB
        allowedExtensions: ['.jpg', '.jpeg', '.png', '.pdf'],
        uploadDir: path.join(__dirname, '../uploads')
    },
    
    // CNN Model configuration
    cnn: {
        modelPath: path.join(__dirname, '../cnn_models'),
        confidenceThreshold: 0.7,
        idTypes: ['National ID', 'Driver License', 'Passport', 'Birth Certificate', 'Others']
    },
    
    // Email configuration
    email: {
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
        from: 'noreply@barangay-drs.com'
    },
    
    // Application settings
    app: {
        name: 'Barangay Document Request System',
        version: '1.0.0',
        description: 'Automated document request system with ID verification'
    }
};

module.exports = config;