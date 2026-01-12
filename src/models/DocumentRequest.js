const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema({
    filename: {
        type: String,
        required: true
    },
    path: {
        type: String,
        required: true
    },
    documentType: {
        type: String,
        enum: ['National ID', 'Driver License', 'Passport', 'Birth Certificate', 'Others'],
        default: 'Others'
    },
    verifiedType: {
        type: String,
        enum: ['National ID', 'Driver License', 'Passport', 'Birth Certificate', 'Others']
    },
    uploadDate: {
        type: Date,
        default: Date.now
    }
});

const verificationResultSchema = new mongoose.Schema({
    isVerified: {
        type: Boolean,
        default: false
    },
    confidenceScore: {
        type: Number,
        min: 0,
        max: 1
    },
    detectedIdType: {
        type: String
    },
    extractedText: {
        type: mongoose.Schema.Types.Mixed
    },
    mismatch: {
        type: Boolean,
        default: false
    },
    mismatchDetails: {
        type: String
    },
    verificationDate: {
        type: Date,
        default: Date.now
    }
});

const documentRequestSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    requestId: {
        type: String,
        unique: true,
        required: true
    },
    documentType: {
        type: String,
        enum: [
            'Certificate of Residency',
            'Barangay Clearance',
            'First-Time Job Seeker Certificate',
            'Certificate of Indigency',
            'Good Moral Certificate',
            'Barangay Permit'
        ],
        required: true
    },
    fullName: {
        type: String,
        required: true
    },
    permanentAddress: {
        type: String,
        required: true
    },
    purpose: {
        type: String,
        required: true
    },
    employmentStatus: {
        type: String,
        enum: ['Employed', 'Unemployed', 'Self-employed', 'Student']
    },
    cellphoneNumber: {
        type: String
    },
    attachments: [attachmentSchema],
    status: {
        type: String,
        enum: ['pending', 'under-review', 'verified', 'failed', 'approved', 'declined', 'ready-to-claim'],
        default: 'pending'
    },
    verificationResult: verificationResultSchema,
    adminNotes: {
        type: String
    },
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    dateRequested: {
        type: Date,
        default: Date.now
    },
    dateProcessed: {
        type: Date
    },
    trackingCode: {
        type: String,
        unique: true
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    }
});

// Generate tracking code before saving
documentRequestSchema.pre('save', function(next) {
    if (!this.trackingCode) {
        this.trackingCode = `TRK${Date.now()}${Math.floor(Math.random() * 1000)}`;
    }
    if (!this.requestId) {
        this.requestId = `REQ${Date.now()}${Math.floor(Math.random() * 1000)}`;
    }
    next();
});

module.exports = mongoose.model('DocumentRequest', documentRequestSchema);