// backend/src/services/ocrService.js - UPDATED TO CALL PYTHON API
const axios = require('axios');

class OCRService {
    constructor() {
        this.pythonApiUrl = 'http://127.0.0.1:5000';
    }

    async extractTextFromImage(imageBuffer, idType = null) {
        try {
            console.log('🔍 Extracting text via Python OCR...');
            
            // Convert to base64
            const base64Image = imageBuffer.toString('base64');
            
            const requestData = {
                image: base64Image
            };
            
            if (idType) {
                requestData.idType = idType;
            }
            
            const response = await axios.post(`${this.pythonApiUrl}/ocr/extract`, requestData, {
                timeout: 15000  // 15 second timeout for OCR
            });
            
            console.log(`✅ OCR Complete: ${response.data.confidence?.toFixed(1) || 'N/A'}% confidence`);
            
            return response.data;
            
        } catch (error) {
            console.error('OCR error:', error.message);
            
            // Fallback to JavaScript implementation if Python fails
            return await this.extractWithTesseract(imageBuffer, idType);
        }
    }

    async extractWithTesseract(imageBuffer, idType) {
        // Your original Tesseract implementation as fallback
        const Tesseract = require('tesseract.js');
        const sharp = require('sharp');
        
        try {
            console.log('⚠️ Using JavaScript Tesseract (Python OCR unavailable)');
            
            const processedBuffer = await sharp(imageBuffer)
                .greyscale()
                .normalize()
                .sharpen()
                .toBuffer();

            const result = await Tesseract.recognize(
                processedBuffer,
                ['eng', 'fil'],
                { logger: m => console.log(m) }
            );

            const ocrResult = {
                text: result.data.text,
                confidence: result.data.confidence,
                words: result.data.words,
                lines: result.data.lines,
                paragraphs: result.data.paragraphs,
                note: 'Using JavaScript Tesseract (Python fallback)'
            };

            // Extract fields if ID type provided
            if (idType) {
                ocrResult.fields = await this.extractFieldsFromID(idType, ocrResult.text);
            }

            return ocrResult;
            
        } catch (error) {
            console.error('Fallback OCR error:', error);
            return {
                text: '',
                confidence: 0,
                error: error.message,
                note: 'OCR service unavailable'
            };
        }
    }

    // Keep your field extraction logic for fallback
    async extractFieldsFromID(idType, text) {
        // Your original field extraction logic
        const fields = {};
        const textLower = text?.toLowerCase() || '';
        
        // Philippine name patterns
        const namePatterns = [
            /name[:\s]+([a-z]+(?:\s+[a-z]+)+)/i,
            /full name[:\s]+([a-z]+(?:\s+[a-z]+)+)/i,
            /pangalan[:\s]+([a-z]+(?:\s+[a-z]+)+)/i
        ];
        
        for (const pattern of namePatterns) {
            const match = text.match(pattern);
            if (match) {
                fields.fullName = match[1].replace(/\b\w/g, char => char.toUpperCase());
                break;
            }
        }
        
        return fields;
    }
}

module.exports = new OCRService();
