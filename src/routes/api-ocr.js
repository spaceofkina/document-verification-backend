const express = require('express');
const router = express.Router();
const multer = require('multer');

// Simple memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Upload and test OCR
router.post('/ocr-upload', upload.single('image'), async (req, res) => {
    try {
        console.log('📤 Received file upload:', req.file);
        
        if (!req.file) {
            return res.status(400).json({ 
                error: 'No image uploaded',
                hint: 'Use form-data with key "image" and select a file'
            });
        }
        
        const OCRService = require('../services/ocrService');
        console.log('🔍 Processing OCR for file:', req.file.originalname);
        
        const ocrResult = await OCRService.extractTextFromImage(req.file.buffer);
        
        res.json({
            status: 'success',
            message: 'OCR processing complete',
            fileInfo: {
                filename: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size,
                encoding: req.file.encoding
            },
            ocrResult: {
                text: ocrResult.text,
                confidence: ocrResult.confidence,
                lines: ocrResult.lines?.slice(0, 5) || [],
                wordCount: ocrResult.words?.length || 0
            }
        });
        
    } catch (error) {
        console.error('OCR Upload Error:', error);
        res.status(500).json({ 
            error: 'OCR processing failed',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

module.exports = router;
