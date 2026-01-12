// backend/src/services/ocrService.js - FIXED WITH HARCODED URLS
const axios = require('axios');
const Tesseract = require('tesseract.js');
const sharp = require('sharp');

class OCRService {
    constructor() {
        // ✅ HARDCORE THE CORRECT URLs
        this.PYTHON_OCR_URL = 'http://127.0.0.1:5000/upload/ocr';
        this.PYTHON_CLASSIFY_URL = 'http://127.0.0.1:5000/upload/classify';
        this.PYTHON_VERIFY_URL = 'http://127.0.0.1:5000/upload/verify';
        
        console.log('🔧 OCRService Initialized:');
        console.log('   OCR URL:', this.PYTHON_OCR_URL);
    }

    async extractTextFromImage(imageBuffer, idType = null) {
        try {
            console.log('🔍 Extracting text via Python OCR...');
            console.log('📡 URL:', this.PYTHON_OCR_URL);
            const startTime = Date.now();
            
            // Use FormData for Python API
            const FormData = require('form-data');
            const formData = new FormData();
            
            // ✅ CORRECT FIELD NAME: "file"
            formData.append('file', imageBuffer, 'ph_document.jpg');
            
            if (idType) {
                formData.append('idType', idType);
            }
            
            // Call Python OCR endpoint with HARCODED URL
            const response = await axios.post(
                this.PYTHON_OCR_URL,
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
            
            if (!response.data.success) {
                throw new Error(`Python OCR error: ${response.data.error}`);
            }
            
            console.log(`✅ Python OCR complete in ${processingTime}ms`);
            
            // Parse Python response
            const pythonResult = response.data;
            
            const result = {
                text: pythonResult.text || '',
                confidence: pythonResult.confidence || 0.0,
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
            console.error('❌ Python OCR error:');
            console.error('   Message:', error.message);
            
            if (error.response) {
                console.error('   Status:', error.response.status);
                console.error('   Data:', error.response.data);
                console.error('   URL called:', error.config?.url);
            }
            
            // Fallback to JavaScript Tesseract
            console.log('⚠️ Falling back to JavaScript Tesseract...');
            return await this.extractWithTesseract(imageBuffer, idType);
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
                ['eng', 'fil'],
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
    
    async completeVerification(imageBuffer, selectedIdType, userData = {}) {
        try {
            console.log('🔍 Complete verification via Python API...');
            console.log('📡 URL:', this.PYTHON_VERIFY_URL);
            
            const FormData = require('form-data');
            const formData = new FormData();
            
            formData.append('file', imageBuffer, 'ph_document.jpg');
            formData.append('userSelectedType', selectedIdType);
            
            if (userData.fullName) {
                formData.append('userFullName', userData.fullName);
            }
            if (userData.address) {
                formData.append('userAddress', userData.address);
            }
            
            const response = await axios.post(
                this.PYTHON_VERIFY_URL,
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