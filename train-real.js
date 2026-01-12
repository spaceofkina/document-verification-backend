// backend/train-real.js - Train with REAL images (no save)
console.log('🚀 Training CNN with REAL Philippine ID images (No Save Mode)...\n');

async function trainWithoutSaving() {
    const tf = require('@tensorflow/tfjs');
    const sharp = require('sharp');
    const path = require('path');
    const fs = require('fs').promises;
    
    try {
        // Initialize TensorFlow
        await tf.setBackend('cpu');
        await tf.ready();
        
        console.log('✅ TensorFlow.js Ready');
        
        // Create simple CNN model
        const model = tf.sequential();
        model.add(tf.layers.conv2d({
            inputShape: [224, 224, 3],
            filters: 16,
            kernelSize: 3,
            activation: 'relu'
        }));
        model.add(tf.layers.maxPooling2d({ poolSize: 2 }));
        model.add(tf.layers.flatten());
        model.add(tf.layers.dense({ units: 64, activation: 'relu' }));
        model.add(tf.layers.dense({ units: 13, activation: 'softmax' }));
        
        model.compile({
            optimizer: 'adam',
            loss: 'categoricalCrossentropy',
            metrics: ['accuracy']
        });
        
        console.log('✅ CNN Model Created (4 layers)');
        
        // Load your REAL images
        console.log('\n🔍 Loading your Philippine ID images...');
        
        const imagePaths = [];
        const labels = [];
        
        // Scan your uploads folder
        const basePath = path.join(process.cwd(), 'uploads/real_ids');
        
        // Document mapping
        const docMapping = {
            'drivers_license': 0,
            'national_id': 1, 
            'umid': 2,
            'passport': 3,
            'postal_id': 4,
            'sss_id': 5,
            'gsis_id': 6,
            'voters_id': 7,
            'philhealth_id': 8,
            'barangay_id': 9,
            'municipal_id': 10,
            'school_id': 11
        };
        
        // Load primary IDs
        const primaryPath = path.join(basePath, 'primary');
        const primaryFolders = await fs.readdir(primaryPath);
        
        for (const folder of primaryFolders) {
            if (docMapping[folder] !== undefined) {
                const folderPath = path.join(primaryPath, folder);
                const files = await fs.readdir(folderPath);
                const images = files.filter(f => /\.(jpg|jpeg|png)$/i.test(f));
                
                for (const imageFile of images) {
                    const imagePath = path.join(folderPath, imageFile);
                    imagePaths.push({ path: imagePath, label: docMapping[folder] });
                    console.log(`   📸 ${folder}: ${imageFile}`);
                }
            }
        }
        
        console.log(`\n📊 Found ${imagePaths.length} real Philippine ID images`);
        
        if (imagePaths.length === 0) {
            console.log('❌ No images found. Check your uploads folder.');
            return;
        }
        
        // Preprocess and train
        console.log('\n🏋️ Training with YOUR real images...');
        
        // Convert images to tensors
        const imageTensors = [];
        const labelTensors = [];
        
        for (const item of imagePaths) {
            try {
                // Load and preprocess image
                const imageBuffer = await fs.readFile(item.path);
                const processedBuffer = await sharp(imageBuffer)
                    .resize(224, 224)
                    .raw()
                    .toBuffer();
                
                const tensor = tf.tensor3d(new Uint8Array(processedBuffer), [224, 224, 3], 'float32');
                const normalized = tensor.div(255.0);
                
                imageTensors.push(normalized);
                labelTensors.push(item.label);
                
                // Clean up
                tensor.dispose();
                
            } catch (error) {
                console.log(`   Skipped ${item.path}: ${error.message}`);
            }
        }
        
        if (imageTensors.length === 0) {
            console.log('❌ No valid images processed');
            return;
        }
        
        console.log(`✅ Processed ${imageTensors.length} images`);
        
        // Create training data
        const xs = tf.stack(imageTensors);
        const ys = tf.oneHot(tf.tensor1d(labelTensors, 'int32'), 13);
        
        // Train
        console.log('📈 Training CNN...');
        const history = await model.fit(xs, ys, {
            epochs: 10,
            batchSize: 2,
            verbose: 1,
            validationSplit: 0.2
        });
        
        // Clean up
        xs.dispose();
        ys.dispose();
        imageTensors.forEach(t => t.dispose());
        
        console.log('\n✅ TRAINING COMPLETE WITH YOUR REAL IMAGES!');
        console.log('🎯 CNN now recognizes YOUR Philippine documents');
        console.log('📊 Final accuracy:', history.history.acc ? history.history.acc[history.history.acc.length - 1].toFixed(4) : 'N/A');
        
        // Test with one image
        if (imagePaths.length > 0) {
            console.log('\n🧪 Testing classification...');
            const testImage = await fs.readFile(imagePaths[0].path);
            const testTensor = tf.tensor3d(
                new Uint8Array(await sharp(testImage).resize(224, 224).raw().toBuffer()),
                [224, 224, 3],
                'float32'
            ).div(255.0).expandDims(0);
            
            const prediction = model.predict(testTensor);
            const predictionData = await prediction.data();
            
            // Get document names
            const docNames = [
                'Drivers License', 'National ID', 'UMID', 'Passport',
                'Postal ID', 'SSS ID', 'GSIS ID', 'Voters ID',
                'PhilHealth ID', 'Barangay ID', 'Municipal ID', 'Student ID', 'Certificate'
            ];
            
            const results = docNames.map((name, idx) => ({
                document: name,
                confidence: predictionData[idx]
            })).sort((a, b) => b.confidence - a.confidence);
            
            console.log('🔍 Classification results:');
            results.slice(0, 3).forEach((r, i) => {
                console.log(`   ${i+1}. ${r.document}: ${(r.confidence * 100).toFixed(1)}%`);
            });
            
            testTensor.dispose();
            prediction.dispose();
        }
        
        console.log('\n🎓 Your CNN is now trained on REAL Philippine documents!');
        console.log('🤖 Ready for thesis demonstration');
        
    } catch (error) {
        console.error('❌ Training error:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Run
trainWithoutSaving();