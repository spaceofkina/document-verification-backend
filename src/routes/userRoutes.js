const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect } = require('../middleware/auth');

// All routes are protected
router.use(protect);

// User profile
router.get('/:id', userController.getUserProfile);
router.put('/:id', userController.updateProfile);
router.put('/:id/password', userController.changePassword);

// NEW: User dashboard features
router.get('/:id/dashboard', userController.getDashboardOverview);
router.get('/:id/eligibility', userController.getRequestEligibility);
router.get('/:id/activity', userController.getActivityLog);

// Notifications (using separate notification controller)
// This will be handled by notificationRoutes.js

module.exports = router;