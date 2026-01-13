const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect } = require('../middleware/auth');

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, '../../uploads/documents');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure disk storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// Use disk storage
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 5
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|pdf/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only images (jpeg, jpg, png) and PDF files are allowed'));
        }
    }
});

// Import controller
const documentController = require('../controllers/documentController');

// All routes are protected
router.use(protect);

// ===== DOCUMENT TYPES & ELIGIBILITY =====
router.get('/types', documentController.getDocumentTypes);
router.get('/check-eligibility/:documentType', documentController.checkRequestEligibility); // ✅ NEW
router.get('/my-history/:documentType', documentController.getUserDocumentTypeHistory); // ✅ NEW

// ===== CREATE DOCUMENT REQUEST =====
router.post('/request', upload.single('idImage'), documentController.createDocumentRequest);

// ===== GET REQUESTS (Resident Track Request) =====
router.get('/my-requests', documentController.getUserRequests); // Resident view

// ===== ADMIN REQUESTS =====
router.get('/all-requests', documentController.getAllRequests); // Admin table view
router.get('/stats', documentController.getRequestStats); // Admin statistics

// ===== REQUEST DETAILS (View Button) =====
router.get('/request/:id', documentController.getRequestDetails); // View details

// ===== UPDATE STATUS (Admin Dropdown) =====
router.put('/request/:id/status', documentController.updateRequestStatus);

// ===== PDF GENERATION =====
router.get('/request/:id/download-pdf', documentController.generatePDF); // Download PDF
router.get('/request/:id/preview-pdf', documentController.previewPDF); // Preview PDF in browser

// ===== UPLOAD ATTACHMENTS =====
router.post('/upload', upload.array('files', 5), documentController.uploadAttachments);

// Error handling for multer
router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        return res.status(400).json({
            status: 'error',
            message: 'File upload error',
            error: err.message
        });
    } else if (err) {
        return res.status(500).json({
            status: 'error',
            message: 'Document server error',
            error: err.message
        });
    }
    next();
});

module.exports = router;