// backend/src/services/ocrService.js - UPDATED WITH CORRECT ENDPOINTS
const axios = require('axios');
const Tesseract = require('tesseract.js');
const sharp = require('sharp');

class OCRService {
    constructor() {
        this.pythonBaseUrl = 'http://127.0.0.1:5000';
        this.ocrEndpoint = '/upload/ocr';
        this.classifyEndpoint = '/upload/classify';
        this.verifyEndpoint = '/upload/verify';
    }

    async extractTextFromImage(imageBuffer, idType = null) {
        try {
            console.log('🔍 Extracting text via Python OCR...');
            const startTime = Date.now();
            
            // Use FormData for Python API
            const FormData = require('form-data');
            const formData = new FormData();
            formData.append('image', imageBuffer, 'ph_document.jpg');
            
            if (idType) {
                formData.append('document_type', idType);
            }
            
            // Call Python OCR endpoint
            const response = await axios.post(
                `${this.pythonBaseUrl}${this.ocrEndpoint}`,
                formData,
                {
                    headers: {
                        ...formData.getHeaders(),
                        'Content-Type': 'multipart/form-data'
                    },
                    timeout: 20000
                }
            );
            
            const processingTime = Date.now() - startTime;
            
            console.log(`✅ OCR Complete (${processingTime}ms): ${response.data.confidence?.toFixed(1) || 'N/A'}% confidence`);
            
            // Parse Python response
            const pythonResult = response.data;
            const result = {
                text: pythonResult.text || 
                      pythonResult.extracted_text || 
                      pythonResult.ocr_text || 
                      '',
                confidence: pythonResult.confidence || 
                           pythonResult.confidence_score || 
                           0.85,
                words: pythonResult.words || [],
                lines: pythonResult.lines || [],
                processingTime: processingTime,
                backend: 'Python OCR (Real)',
                fields: pythonResult.fields || {}
            };
            
            // If idType provided and no fields extracted, try to extract
            if (idType && Object.keys(result.fields).length === 0) {
                result.fields = await this.extractFieldsFromID(idType, result.text);
            }
            
            return result;
            
        } catch (error) {
            console.error('Python OCR error:', error.message);
            
            if (error.response) {
                console.error('Error response:', error.response.data);
                console.error('Error status:', error.response.status);
            }
            
            // Fallback to JavaScript Tesseract
            console.log('⚠️ Falling back to JavaScript Tesseract...');
            return await this.extractWithTesseract(imageBuffer, idType);
        }
    }

    async extractTextFromPDF(pdfBuffer) {
        try {
            console.log('🔍 Extracting text from PDF via Python OCR...');
            
            const FormData = require('form-data');
            const formData = new FormData();
            formData.append('pdf', pdfBuffer, 'document.pdf');
            
            const response = await axios.post(
                `${this.pythonBaseUrl}${this.ocrEndpoint}`,
                formData,
                {
                    headers: {
                        ...formData.getHeaders(),
                        'Content-Type': 'multipart/form-data'
                    },
                    timeout: 30000
                }
            );
            
            return {
                text: response.data.text || '',
                confidence: response.data.confidence || 0.8,
                pages: response.data.pages || 1,
                backend: 'Python PDF OCR'
            };
            
        } catch (error) {
            console.error('PDF OCR error:', error.message);
            return await this.extractWithTesseract(pdfBuffer);
        }
    }

    async extractWithTesseract(imageBuffer, idType) {
        try {
            console.log('⚠️ Using JavaScript Tesseract (Python OCR unavailable)');
            const startTime = Date.now();
            
            // Preprocess image for better OCR
            const processedBuffer = await sharp(imageBuffer)
                .greyscale()
                .normalize()
                .sharpen()
                .threshold(128)
                .toBuffer();

            const result = await Tesseract.recognize(
                processedBuffer,
                ['eng', 'fil'], // English and Filipino
                {
                    logger: m => {
                        if (m.status === 'recognizing text') {
                            console.log(`   OCR Progress: ${m.progress * 100}%`);
                        }
                    }
                }
            );

            const processingTime = Date.now() - startTime;
            
            const ocrResult = {
                text: result.data.text,
                confidence: result.data.confidence,
                words: result.data.words,
                lines: result.data.lines,
                paragraphs: result.data.paragraphs,
                processingTime: processingTime,
                note: 'Using JavaScript Tesseract (Python fallback)',
                backend: 'JavaScript Tesseract',
                language: 'eng+fil'
            };

            // Extract fields if ID type provided
            if (idType) {
                ocrResult.fields = await this.extractFieldsFromID(idType, ocrResult.text);
            }

            console.log(`✅ Tesseract OCR Complete (${processingTime}ms): ${ocrResult.confidence.toFixed(1)}% confidence`);
            
            return ocrResult;
            
        } catch (error) {
            console.error('Fallback OCR error:', error);
            return {
                text: '',
                confidence: 0,
                error: error.message,
                note: 'OCR service unavailable',
                processingTime: 0
            };
        }
    }

    async extractFieldsFromID(idType, textOrResult) {
        try {
            const text = typeof textOrResult === 'string' ? textOrResult : textOrResult.text || '';
            const fields = {};
            
            if (!text) {
                return fields;
            }
            
            const textLower = text.toLowerCase();
            
            // Extract name based on Philippine ID patterns
            const namePatterns = [
                /name[:\s]+\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/,
                /full name[:\s]+\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/,
                /pangalan[:\s]+\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/,
                /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/m
            ];
            
            for (const pattern of namePatterns) {
                const match = text.match(pattern);
                if (match && match[1]) {
                    fields.fullName = match[1].trim();
                    break;
                }
            }
            
            // Extract ID number patterns
            const idPatterns = [
                /id[:\s#]*\s*([A-Z0-9\-]+)/i,
                /no[:\s]+\s*([A-Z0-9\-]+)/i,
                /number[:\s]+\s*([A-Z0-9\-]+)/i,
                /([A-Z]{1,2}\d{2}[-]\d{2}[-]\d{6})/, // PhilSys pattern
                /(\d{4}[-]\d{4}[-]\d{4})/ // Common ID pattern
            ];
            
            for (const pattern of idPatterns) {
                const match = text.match(pattern);
                if (match && match[1]) {
                    fields.idNumber = match[1].trim();
                    break;
                }
            }
            
            // Extract address (Philippine addresses)
            const addressPatterns = [
                /address[:\s]+\s*([^\n\r]+)/i,
                /tirahan[:\s]+\s*([^\n\r]+)/i,
                /(?:brgy|barangay)[.\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
                /(?:municipality|munisipyo|city|lungsod)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i
            ];
            
            for (const pattern of addressPatterns) {
                const match = text.match(pattern);
                if (match && match[1]) {
                    fields.address = match[1].trim();
                    break;
                }
            }
            
            // Extract birth date
            const datePatterns = [
                /birth[:\s]+\s*([\d\/\-]+)/i,
                /birthday[:\s]+\s*([\d\/\-]+)/i,
                /kapanganakan[:\s]+\s*([\d\/\-]+)/i,
                /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/ // MM/DD/YYYY
            ];
            
            for (const pattern of datePatterns) {
                const match = text.match(pattern);
                if (match && match[1]) {
                    fields.birthDate = match[1].trim();
                    break;
                }
            }
            
            return fields;
            
        } catch (error) {
            console.error('Field extraction error:', error.message);
            return {};
        }
    }
    
    async completeVerification(imageBuffer, selectedIdType) {
        try {
            console.log('🔍 Complete verification via Python API...');
            
            const FormData = require('form-data');
            const formData = new FormData();
            formData.append('image', imageBuffer, 'ph_document.jpg');
            formData.append('selected_type', selectedIdType);
            
            const response = await axios.post(
                `${this.pythonBaseUrl}${this.verifyEndpoint}`,
                formData,
                {
                    headers: {
                        ...formData.getHeaders(),
                        'Content-Type': 'multipart/form-data'
                    },
                    timeout: 25000
                }
            );
            
            return response.data;
            
        } catch (error) {
            console.error('Complete verification error:', error.message);
            
            // Fallback to separate CNN + OCR
            const CNNService = require('./cnnService');
            const cnnResult = await CNNService.classifyID(imageBuffer);
            const ocrResult = await this.extractTextFromImage(imageBuffer, cnnResult.detectedIdType);
            
            return {
                cnn_result: cnnResult,
                ocr_result: ocrResult,
                verification: {
                    match: selectedIdType === cnnResult.detectedIdType,
                    confidence: cnnResult.confidenceScore,
                    note: 'Fallback verification (Python API unavailable)'
                }
            };
        }
    }
}

module.exports = new OCRService();