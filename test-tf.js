// test-tf.js - Philippine Document System
console.log('Testing TensorFlow for Philippine Document System...');
console.log('====================================================');

try {
    console.log('1. Loading TensorFlow for Philippine Document Recognition...');
    const tf = require('@tensorflow/tfjs-node');
    console.log('✅ TensorFlow.js Node backend loaded successfully!');
    
    // Test basic tensor operations
    console.log('\n2. Testing tensor operations for Philippine documents...');
    const a = tf.tensor2d([[1, 2], [3, 4]]);
    const b = tf.tensor2d([[5, 6], [7, 8]]);
    const result = a.add(b);
    
    console.log('✅ Tensor addition working!');
    console.log('   Result:', result.arraySync());
    
    // Test CNN model creation for 13 Philippine document types
    console.log('\n3. Testing Philippine Document CNN model creation...');
    const model = tf.sequential();
    
    // Convolutional layer 1
    model.add(tf.layers.conv2d({
        inputShape: [224, 224, 3],
        filters: 32,
        kernelSize: 3,
        activation: 'relu',
        padding: 'same'
    }));
    model.add(tf.layers.maxPooling2d({ poolSize: 2 }));
    
    // Convolutional layer 2
    model.add(tf.layers.conv2d({
        filters: 64,
        kernelSize: 3,
        activation: 'relu',
        padding: 'same'
    }));
    model.add(tf.layers.maxPooling2d({ poolSize: 2 }));
    
    // Convolutional layer 3
    model.add(tf.layers.conv2d({
        filters: 128,
        kernelSize: 3,
        activation: 'relu',
        padding: 'same'
    }));
    model.add(tf.layers.maxPooling2d({ poolSize: 2 }));
    
    model.add(tf.layers.flatten());
    model.add(tf.layers.dense({ units: 256, activation: 'relu' }));
    model.add(tf.layers.dropout({ rate: 0.5 }));
    
    // Output layer for 13 Philippine document types
    model.add(tf.layers.dense({
        units: 13, // 9 Primary + 4 Secondary Philippine IDs
        activation: 'softmax'
    }));
    
    model.compile({
        optimizer: 'adam',
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
    });
    
    console.log('✅ Philippine Document CNN model created successfully!');
    console.log('   Model summary for Philippine System:');
    console.log('   - Input shape: [224, 224, 3]');
    console.log('   - Convolutional layers: 3');
    console.log('   - Dense layers: 2');
    console.log('   - Output classes: 13 (Philippine Document Types)');
    console.log('   - Primary IDs: 9 types');
    console.log('   - Secondary IDs: 4 types');
    
    // List Philippine document types
    console.log('\n4. Philippine Document Types Supported:');
    console.log('   Primary IDs (9):');
    const primaryIDs = [
        'Philippine Passport',
        'UMID (Unified Multi-Purpose ID)',
        'Drivers License (LTO)',
        'Postal ID',
        'National ID (PhilSys)',
        'SSS ID (Social Security System)',
        'GSIS ID (Government Service Insurance System)',
        'Voters ID',
        'PhilHealth ID'
    ];
    
    primaryIDs.forEach((id, index) => {
        console.log(`      ${index + 1}. ${id}`);
    });
    
    console.log('\n   Secondary IDs (4):');
    const secondaryIDs = [
        'Municipal ID',
        'TIN ID (Tax Identification Number)',
        'Barangay ID',
        'Student ID'
    ];
    
    secondaryIDs.forEach((id, index) => {
        console.log(`      ${index + 1}. ${id}`);
    });
    
    console.log('\n🎉 TensorFlow is READY for Philippine Document System!');
    console.log('System: Brgy. Lajong Document Request System');
    console.log('Purpose: Thesis - Philippine Document Verification');
    console.log('AI Components: CNN Classification + OCR Extraction');
    console.log('\nNext Steps:');
    console.log('1. Run: node backend/train-cnn.js (Train with Philippine documents)');
    console.log('2. Test: curl -X POST http://localhost:3000/api/cnn-classify');
    console.log('3. Verify: Use Philippine ID images for testing');
    
} catch (error) {
    console.error('\n❌ TensorFlow failed to load:', error.message);
    console.error('\nTroubleshooting for Philippine Document System:');
    console.error('1. Make sure you have TensorFlow.js installed:');
    console.error('   npm install @tensorflow/tfjs-node@4.22.0');
    console.error('2. Check Node.js version (>= 18.0.0)');
    console.error('3. Ensure Visual Studio Build Tools are installed');
    console.error('4. Try: npm rebuild @tensorflow/tfjs-node --build-from-source');
    console.error('\nFor thesis development, you can continue with demonstration mode.');
}