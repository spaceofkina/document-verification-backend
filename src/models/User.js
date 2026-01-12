const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: 6
    },
    firstName: {
        type: String,
        required: [true, 'First name is required'],
        trim: true
    },
    lastName: {
        type: String,
        required: [true, 'Last name is required'],
        trim: true
    },
    role: {
        type: String,
        enum: ['user', 'admin', 'staff'],
        default: 'user'
    },
    barangayName: {
        type: String,
        trim: true
    },
    contactNumber: {
        type: String,
        trim: true
    },
    address: {
        type: String,
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastLogin: {
        type: Date
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Update timestamp
userSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Static method to create default Brgy Lajong admin
userSchema.statics.createBrgyLajongAdmin = async function() {
    try {
        const adminEmail = 'adminclient@barangay.com';
        const existingAdmin = await this.findOne({ email: adminEmail });
        
        if (!existingAdmin) {
            const adminData = {
                email: adminEmail,
                password: 'brgylajong321_clnt',
                firstName: 'Barangay Lajong',
                lastName: 'Administrator',
                role: 'admin',
                barangayName: 'Brgy Lajong',
                contactNumber: '09123456789',
                address: 'Barangay Lajong, Bulan, Sorsogon',
                isActive: true
            };
            
            await this.create(adminData);
            console.log('✅ Default Brgy Lajong admin account created');
            return true;
        }
        
        console.log('ℹ️  Brgy Lajong admin account already exists');
        return false;
    } catch (error) {
        console.error('❌ Error creating Brgy Lajong admin:', error);
        return false;
    }
};

// Static method to create default staff
userSchema.statics.createBrgyLajongStaff = async function() {
    try {
        const staffEmail = 'staff@brgylajong.com';
        const existingStaff = await this.findOne({ email: staffEmail });
        
        if (!existingStaff) {
            const staffData = {
                email: staffEmail,
                password: 'staff_lajong321',
                firstName: 'Barangay Lajong',
                lastName: 'Staff',
                role: 'staff',
                barangayName: 'Brgy Lajong',
                contactNumber: '09123456788',
                address: 'Barangay Lajong, Bulan, Sorsogon',
                isActive: true
            };
            
            await this.create(staffData);
            console.log('✅ Default Brgy Lajong staff account created');
            return true;
        }
        
        console.log('ℹ️  Brgy Lajong staff account already exists');
        return false;
    } catch (error) {
        console.error('❌ Error creating Brgy Lajong staff:', error);
        return false;
    }
};

module.exports = mongoose.model('User', userSchema);