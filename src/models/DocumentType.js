const mongoose = require('mongoose');

const documentTypeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    description: {
        type: String
    },
    requirements: [{
        type: String
    }],
    processingTime: {
        type: Number, // in days
        default: 3
    },
    fee: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    },
    templatePath: {
        type: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('DocumentType', documentTypeSchema);