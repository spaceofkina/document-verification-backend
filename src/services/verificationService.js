const cnnService = require('./cnnService');
const ocrService = require('./ocrService');
const fs = require('fs').promises;

class VerificationService {
    async verifyDocument(attachment, userSelectedType) {
        try {
            // Read the uploaded file
            const fileBuffer = await fs.readFile(attachment.path);
            
            // Step 1: Classify document using CNN
            const cnnResult = await cnnService.classifyID(fileBuffer);
            
            // Step 2: Extract text using OCR
            let ocrResult;
            if (attachment.filename.endsWith('.pdf')) {
                ocrResult = await ocrService.extractTextFromPDF(fileBuffer);
            } else {
                ocrResult = await ocrService.extractTextFromImage(fileBuffer);
            }
            
            // Step 3: Verify if detected type matches user selection
            const verificationResult = await cnnService.verifyIDMatch(
                userSelectedType,
                cnnResult.detectedIdType,
                cnnResult.confidenceScore
            );
            
            // Step 4: Extract specific fields from OCR result
            const extractedFields = await ocrService.extractFieldsFromID(
                cnnResult.detectedIdType,
                ocrResult
            );
            
            return {
                ...verificationResult,
                extractedText: {
                    rawText: ocrResult.text,
                    confidence: ocrResult.confidence,
                    extractedFields: extractedFields
                },
                processingDate: new Date()
            };
            
        } catch (error) {
            console.error('Verification error:', error);
            return {
                isVerified: false,
                confidenceScore: 0,
                detectedIdType: 'Unknown',
                extractedText: {},
                mismatch: true,
                mismatchDetails: 'Error during verification process'
            };
        }
    }

    async verifyMultipleDocuments(attachments, userSelectedTypes) {
        const results = [];
        
        for (let i = 0; i < attachments.length; i++) {
            const result = await this.verifyDocument(
                attachments[i],
                userSelectedTypes[i]
            );
            results.push(result);
        }
        
        // Determine overall verification status
        const overallVerified = results.every(result => result.isVerified);
        const averageConfidence = results.reduce((sum, result) => 
            sum + result.confidenceScore, 0) / results.length;
        
        return {
            overallVerified,
            averageConfidence,
            individualResults: results,
            hasMismatch: results.some(result => result.mismatch),
            mismatchDetails: results
                .filter(result => result.mismatch)
                .map(result => result.mismatchDetails)
        };
    }

    async validateRequestData(requestData) {
        const errors = [];
        
        // Validate required fields
        if (!requestData.fullName || requestData.fullName.trim().length < 3) {
            errors.push('Full name must be at least 3 characters');
        }
        
        if (!requestData.permanentAddress || requestData.permanentAddress.trim().length < 10) {
            errors.push('Please provide a valid permanent address');
        }
        
        if (!requestData.purpose || requestData.purpose.trim().length < 5) {
            errors.push('Please specify the purpose of request');
        }
        
        // Validate document type
        const validDocumentTypes = [
            'Certificate of Residency',
            'Barangay Clearance',
            'First-Time Job Seeker Certificate',
            'Certificate of Indigency',
            'Good Moral Certificate',
            'Barangay Permit'
        ];
        
        if (!validDocumentTypes.includes(requestData.documentType)) {
            errors.push('Invalid document type');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }
}

module.exports = new VerificationService();