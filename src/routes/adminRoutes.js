const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protect } = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

// Admin-only routes
router.use(protect, roleCheck('admin', 'staff'));

// === DASHBOARD ===
router.get('/dashboard', adminController.getAdminDashboard);
router.get('/stats', adminController.getDashboardStats);
router.get('/notifications', adminController.getAdminNotifications);

// === REQUEST MANAGEMENT ===
router.get('/requests', adminController.getAllRequests);
router.get('/requests/:id', adminController.getRequestDetails);
router.put('/requests/:id/status', adminController.updateRequestStatus);
router.post('/requests/:id/verify', adminController.verifyDocument);

// === USER MANAGEMENT ===
router.get('/users', adminController.getUsers);
router.put('/users/:id', adminController.updateUser);
router.post('/users/:userId/notify', adminController.createUserNotification);

// === PDF GENERATION & VIEWING ===
router.get('/requests/:id/view-pdf', adminController.viewPDF);
router.get('/requests/:id/download-pdf', adminController.downloadPDF);
router.get('/templates/preview/:templateName', adminController.previewTemplate);
router.get('/templates', adminController.getAvailableTemplates);
router.get('/requests/:id/preview', adminController.generateDocumentPreview);

// === ATTACHMENTS ===
router.get('/requests/:id/attachments/:filename', adminController.downloadAttachment);

module.exports = router;