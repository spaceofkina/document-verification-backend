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

// Notifications
router.get('/:id/notifications', userController.getNotifications);

module.exports = router;