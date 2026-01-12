const fs = require('fs').promises;
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

// Import models and seed function
const seedDatabase = require('./src/utils/seedData');

async function setupDatabase() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ Connected to MongoDB');

        // Clear existing data if reset flag is provided
        if (process.argv.includes('--reset')) {
            const User = require('./src/models/User');
            const DocumentType = require('./src/models/DocumentType');
            const DocumentRequest = require('./src/models/DocumentRequest');
            
            await DocumentRequest.deleteMany({});
            await User.deleteMany({});
            await DocumentType.deleteMany({});
            console.log('🗑️  Cleared all existing data');
        }

        // Create upload directories
        const directories = [
            'uploads/ids',
            'uploads/documents',
            'uploads/temp',
            'cnn_models',
            'templates'
        ];

        for (const dir of directories) {
            await fs.mkdir(dir, { recursive: true });
            console.log(`📁 Created directory: ${dir}`);
        }

        // Seed database with default Brgy Lajong data
        await seedDatabase();

        console.log('\n' + '='.repeat(60));
        console.log('✅ SETUP COMPLETE - BRGY LAJONG DRS');
        console.log('='.repeat(60));
        console.log('\n🔐 DEFAULT LOGIN CREDENTIALS:');
        console.log('   ┌─────────────────────────────────────────────┐');
        console.log('   │ 👑 ADMIN:  adminclient@barangay.com         │');
        console.log('   │        Password: brgylajong321_clnt         │');
        console.log('   │                                             │');
        console.log('   │ 👨‍💼 STAFF:  staff@brgylajong.com           │');
        console.log('   │        Password: staff_lajong321           │');
        console.log('   └─────────────────────────────────────────────┘');
        console.log('\n📍 BARANGAY: Brgy Lajong, Bulan, Sorsogon');
        console.log('\n🚀 Start the server with: npm run dev');
        console.log('\n⚠️  IMPORTANT: Change passwords after first login!');
        console.log('='.repeat(60));

    } catch (error) {
        console.error('❌ Setup failed:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
    }
}

setupDatabase();