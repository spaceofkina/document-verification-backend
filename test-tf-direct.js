// test-tf-direct.js
console.log('Direct TensorFlow.js Node Test\n');

const tf = require('@tensorflow/tfjs-node');

async function test() {
    try {
        console.log('1. Loading TensorFlow.js Node...');
        await tf.ready();
        
        console.log('2. Backend:', tf.getBackend());
        console.log('3. Version:', tf.version.tfjs);
        
        console.log('\n4. Testing tensor operations...');
        
        // Test 1: Simple tensor
        const a = tf.tensor([1, 2, 3, 4]);
        console.log('   Simple tensor:', a.shape, a.dataSync());
        a.dispose();
        
        // Test 2: CNN-like operation
        const input = tf.ones([1, 224, 224, 3]);
        console.log('   CNN input tensor:', input.shape);
        input.dispose();
        
        // Test 3: Model creation
        const model = tf.sequential();
        model.add(tf.layers.dense({units: 10, inputShape: [5]}));
        model.add(tf.layers.dense({units: 1}));
        model.compile({optimizer: 'sgd', loss: 'meanSquaredError'});
        console.log('   Model created successfully');
        
        console.log('\n✅ TensorFlow.js Node is WORKING PERFECTLY!');
        console.log('🎯 Ready for CNN training!');
        
    } catch (error) {
        console.error('❌ TensorFlow error:', error.message);
        console.error('Stack:', error.stack);
        
        if (error.message.includes('NODE_MODULE_VERSION')) {
            console.log('\n💡 NODE_MODULE_VERSION mismatch!');
            console.log('Your Node.js version:', process.version);
            console.log('Solution:');
            console.log('1. npm uninstall @tensorflow/tfjs-node');
            console.log('2. Install Python and build tools');
            console.log('3. npm install @tensorflow/tfjs-node@4.22.0 --build-from-source');
        }
    }
}

test();