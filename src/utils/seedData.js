// src/utils/seedData.js
const User = require('../models/User');
const DocumentType = require('../models/DocumentType');

const defaultUsers = [
    {
        email: 'adminclient@barangay.com',
        password: 'brgylajong321_clnt',
        firstName: 'Barangay Lajong',
        lastName: 'Administrator',
        role: 'admin',
        barangayName: 'Brgy Lajong',
        contactNumber: '09123456789',
        address: 'Barangay Lajong, Bulan, Sorsogon'
    },
    {
        email: 'staff@brgylajong.com',
        password: 'staff_lajong321',
        firstName: 'Barangay Lajong',
        lastName: 'Staff',
        role: 'staff',
        barangayName: 'Brgy Lajong',
        contactNumber: '09123456788',
        address: 'Barangay Lajong, Bulan, Sorsogon'
    }
];

const documentTypes = [
    {
        name: 'Certificate of Residency',
        description: 'Certifies that an individual is a resident of Brgy Lajong',
        requirements: ['Valid ID', 'Proof of Residency'],
        processingTime: 3,
        fee: 0
    },
    {
        name: 'Barangay Clearance',
        description: 'Certifies that an individual has no derogatory record in Brgy Lajong',
        requirements: ['Valid ID', 'Barangay Clearance Form'],
        processingTime: 2,
        fee: 50
    },
    {
        name: 'First-Time Job Seeker Certificate',
        description: 'For first-time job seekers to avail of free documents',
        requirements: ['Valid ID', 'Barangay Certificate', 'School ID or Diploma'],
        processingTime: 1,
        fee: 0
    },
    {
        name: 'Certificate of Indigency',
        description: 'Certifies that an individual belongs to an indigent family in Brgy Lajong',
        requirements: ['Valid ID', 'Income Certificate', 'Family Picture'],
        processingTime: 5,
        fee: 0
    },
    {
        name: 'Good Moral Certificate',
        description: 'Certifies that an individual possesses good moral character',
        requirements: ['Valid ID', 'Barangay Clearance', 'Personal Data Sheet'],
        processingTime: 3,
        fee: 30
    },
    {
        name: 'Barangay Permit',
        description: 'Permit for business operations within Brgy Lajong',
        requirements: ['Business Permit Application', 'Valid ID', 'Location Sketch'],
        processingTime: 7,
        fee: 500
    }
];

async function seedDatabase() {
    try {
        console.log('🌱 Seeding database for Brgy Lajong...');
        
        // Seed users
        for (const userData of defaultUsers) {
            const existingUser = await User.findOne({ email: userData.email });
            if (!existingUser) {
                await User.create(userData);
                console.log(`✅ Created user: ${userData.email}`);
            } else {
                console.log(`ℹ️  User already exists: ${userData.email}`);
            }
        }
        
        // Seed document types
        for (const docType of documentTypes) {
            const existingDoc = await DocumentType.findOne({ name: docType.name });
            if (!existingDoc) {
                await DocumentType.create(docType);
                console.log(`✅ Created document type: ${docType.name}`);
            } else {
                console.log(`ℹ️  Document type already exists: ${docType.name}`);
            }
        }
        
        console.log('✅ Database seeding completed!');
        console.log('\n🔐 Default Login Credentials for Brgy Lajong:');
        console.log('   Admin: adminclient@barangay.com / brgylajong321_clnt');
        console.log('   Staff: staff@brgylajong.com / staff_lajong321');
        console.log('\n⚠️  IMPORTANT: Change these passwords after first login!');
        
        return true;
    } catch (error) {
        console.error('❌ Database seeding failed:', error);
        return false;
    }
}

module.exports = seedDatabase;