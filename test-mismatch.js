const express = require('express');
const multer = require('multer');
const { createCanvas } = require('canvas');

const storage = multer.memoryStorage();
const upload = multer({ storage });

const testMismatch = async () => {
    console.log('Testing ID Mismatch Detection...\n');
    
    // Create National ID image
    const canvas = createCanvas(400, 250);
    const ctx = canvas.getContext('2d');
    
    // Draw National ID
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 400, 250);
    ctx.fillStyle = '#003366';
    ctx.fillRect(0, 0, 400, 40);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Arial';
    ctx.fillText('NATIONAL ID CARD', 100, 25);
    ctx.fillStyle = '#000000';
    ctx.font = '14px Arial';
    ctx.fillText('PHILIPPINE IDENTIFICATION SYSTEM', 50, 70);
    ctx.fillText('Name: JUAN DELA CRUZ', 30, 100);
    ctx.fillText('ID: 1234-5678-9012', 30, 130);
    ctx.fillText('Birth: 01/01/1990', 30, 160);
    ctx.fillText('Address: Brgy. Lajong', 30, 190);
    
    const nationalIDBuffer = canvas.toBuffer('image/png');
    
    console.log('Created National ID image\n');
    
    // Import your services
    const cnnService = require('./src/services/cnnService');
    const OCRService = require('./src/services/ocrService');
    
    console.log('1. CNN Classifying uploaded image...');
    const cnnResult = await cnnService.classifyID(nationalIDBuffer);
    console.log(`   Detected: ${cnnResult.detectedIdType}`);
    console.log(`   Confidence: ${(cnnResult.confidenceScore * 100).toFixed(1)}%\n`);
    
    console.log('2. OCR Extracting text...');
    const ocrResult = await OCRService.extractTextFromImage(nationalIDBuffer);
    console.log(`   Text extracted: ${ocrResult.text.substring(0, 50)}...\n`);
    
    console.log('3. User selected: PASSPORT (in form)');
    console.log('   CNN detected: NATIONAL ID (from image)\n');
    
    console.log('4. Verification Process:');
    const verification = await cnnService.verifyIDMatch(
        'Passport', // What user selected
        cnnResult.detectedIdType, // What CNN detected
        cnnResult.confidenceScore // How confident
    );
    
    console.log('   Is Verified?', verification.isVerified ? '✅ YES' : '❌ NO');
    console.log('   Mismatch?', verification.mismatch ? '⚠️  YES - MISMATCH!' : 'No');
    console.log('   Details:', verification.mismatchDetails || 'No issues');
    console.log('\n5. System would show warning to user:');
    console.log('   ⚠️  WARNING: System detected National ID');
    console.log('      but you selected Passport.');
    console.log('      Please verify your document selection.');
    
    return verification;
};

testMismatch().catch(console.error);
