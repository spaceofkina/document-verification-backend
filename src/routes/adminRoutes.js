const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protect } = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

// Admin-only routes
router.use(protect, roleCheck('admin', 'staff'));

// Request management
router.get('/requests', adminController.getAllRequests);
router.get('/requests/:id', adminController.getRequestDetails);
router.put('/requests/:id/status', adminController.updateRequestStatus);
router.post('/requests/:id/verify', adminController.verifyDocument);

// Dashboard
router.get('/stats', adminController.getDashboardStats);

// === PDF GENERATION & VIEWING ===
// View PDF (opens in browser)
router.get('/requests/:id/view-pdf', adminController.viewPDF);

// Download PDF (downloads file)
router.get('/requests/:id/download-pdf', adminController.downloadPDF);

// Preview template without data
router.get('/templates/preview/:templateName', adminController.previewTemplate);

// Get all available templates
router.get('/templates', adminController.getAvailableTemplates);

// Document generation preview (legacy - keep for compatibility)
router.get('/requests/:id/preview', adminController.generateDocumentPreview);

// Attachments
router.get('/requests/:id/attachments/:filename', adminController.downloadAttachment);

module.exports = router;