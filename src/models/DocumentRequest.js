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
        default: 'Philippine ID'
    },
    verifiedType: {
        type: String,
        default: 'Pending Verification'
    },
    verificationConfidence: {
        type: Number,
        min: 0,
        max: 100
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
        type: String,
        default: 'Pending'
    },
    extractedText: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    mismatch: {
        type: Boolean,
        default: false
    },
    mismatchDetails: {
        type: String,
        default: ''
    },
    verificationDate: {
        type: Date,
        default: Date.now
    },
    userConfirmed: {
        type: Boolean,
        default: false
    },
    warningMessage: {
        type: String,
        default: ''
    },
    algorithmStatus: {
        type: String,
        default: 'pending'
    },
    isRealCNN: {
        type: Boolean,
        default: false
    },
    backendUsed: {
        type: String,
        default: 'Unknown'
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
        required: [true, 'Full name is required'],
        trim: true
    },
    permanentAddress: {
        type: String,
        required: [true, 'Permanent address is required'],
        trim: true
    },
    purpose: {
        type: String,
        required: [true, 'Purpose is required'],
        trim: true
    },
    employmentStatus: {
        type: String,
        enum: ['Employed', 'Unemployed', 'Self-employed', 'Student', 'Retired'],
        default: 'Unemployed'
    },
    cellphoneNumber: {
        type: String,
        trim: true
    },
    attachments: [attachmentSchema],
    status: {
        type: String,
        enum: ['pending', 'under-review', 'verified', 'approved', 'declined', 'ready-to-claim', 'claimed'], // ✅ ADDED 'claimed'
        default: 'pending'
    },
    verificationResult: verificationResultSchema,
    adminNotes: {
        type: String,
        trim: true
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
    dateClaimed: { // ✅ NEW FIELD for claimed date
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
    },
    barangay: {
        type: String,
        default: 'Brgy. Lajong'
    }
});

// Generate IDs before saving
documentRequestSchema.pre('save', function(next) {
    if (!this.requestId) {
        this.requestId = `BRGY${Date.now()}${Math.floor(Math.random() * 1000)}`;
    }
    if (!this.trackingCode) {
        this.trackingCode = `TRK${Date.now()}${Math.floor(Math.random() * 1000)}`;
    }
    next();
});

// Index for faster queries
documentRequestSchema.index({ userId: 1, status: 1 });
documentRequestSchema.index({ documentType: 1, status: 1 }); // ✅ NEW INDEX for document type queries
documentRequestSchema.index({ dateRequested: -1 });
documentRequestSchema.index({ trackingCode: 1 });

module.exports = mongoose.model('DocumentRequest', documentRequestSchema);