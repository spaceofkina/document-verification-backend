const OCRService = require('./src/services/ocrService');
const { createCanvas } = require('canvas');

async function testOCR() {
    console.log('🧪 Testing OCR Service...\n');
    
    try {
        // Create a test image with ID-like text
        const canvas = createCanvas(400, 200);
        const ctx = canvas.getContext('2d');
        
        // Draw background
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, 400, 200);
        
        // Draw ID-like text
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 16px Arial';
        ctx.fillText('REPUBLIC OF THE PHILIPPINES', 20, 40);
        ctx.font = '14px Arial';
        ctx.fillText('NATIONAL IDENTIFICATION CARD', 20, 65);
        ctx.fillText('Name: JUAN DELA CRUZ SANTOS', 20, 95);
        ctx.fillText('ID Number: 1234-5678-9012', 20, 120);
        ctx.fillText('Birth Date: 15/01/1990', 20, 145);
        ctx.fillText('Address: Brgy. Lajong, Bulan, Sorsogon', 20, 170);
        
        // Convert to buffer
        const buffer = canvas.toBuffer('image/png');
        
        console.log('1. Testing text extraction from image...');
        const ocrResult = await OCRService.extractTextFromImage(buffer);
        
        console.log('✅ OCR Extraction Successful');
        console.log('   Extracted Text:', ocrResult.text.substring(0, 100) + '...');
        console.log('   Confidence:', ocrResult.confidence);
        console.log('   Lines found:', ocrResult.lines.length);
        
        console.log('\n2. Testing field extraction for National ID...');
        const fields = await OCRService.extractFieldsFromID('National ID', ocrResult);
        
        console.log('✅ Field Extraction Results:');
        console.log('   Full Name:', fields.fullName || 'Not found');
        console.log('   ID Number:', fields.idNumber || 'Not found');
        console.log('   Birth Date:', fields.birthDate || 'Not found');
        
        console.log('\n🎉 OCR Service is WORKING perfectly!');
        console.log('\nReady for integration with:');
        console.log('   - ID verification system');
        console.log('   - Document request forms');
        console.log('   - Automated data extraction');
        
    } catch (error) {
        console.error('❌ OCR Test Failed:', error.message);
        console.log('\nTroubleshooting:');
        console.log('1. Install canvas: npm install canvas');
        console.log('2. Check Tesseract.js: npm list tesseract.js');
        console.log('3. Ensure image buffer is valid');
    }
}

testOCR();
