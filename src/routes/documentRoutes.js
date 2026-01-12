const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

// All routes are protected
router.use(protect);

// Document types
router.get('/types', documentController.getDocumentTypes);

// Document requests
router.post('/request', 
    upload.array('attachments', 5), // Max 5 files
    documentController.createDocumentRequest
);

router.get('/user/:userId', documentController.getUserRequests);
router.get('/:id', documentController.getRequestDetails);
router.put('/:id', 
    upload.array('attachments', 5),
    documentController.updateRequest
);

// Upload attachments separately
router.post('/upload',
    upload.array('files', 5),
    documentController.uploadAttachments
);

// Download generated document
router.get('/:id/download', documentController.downloadDocument);

module.exports = router;