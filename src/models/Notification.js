const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['request_created', 'status_changed', 'document_ready', 'admin_message', 'system_alert', 'verification_result'],
        required: true
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    data: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    read: {
        type: Boolean,
        default: false
    },
    readAt: {
        type: Date
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    actionUrl: {
        type: String
    },
    icon: {
        type: String,
        default: 'info'
    },
    expiresAt: {
        type: Date
    }
}, {
    timestamps: true
});

// Index for faster queries
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 }); // Auto-delete after 30 days

// Static method to create notification
notificationSchema.statics.createNotification = async function(userId, type, title, message, data = {}, priority = 'medium', actionUrl = null) {
    try {
        const notification = await this.create({
            userId,
            type,
            title,
            message,
            data,
            priority,
            actionUrl,
            icon: this.getIconForType(type)
        });
        return notification;
    } catch (error) {
        console.error('Error creating notification:', error);
        return null;
    }
};

// Get icon based on notification type
notificationSchema.statics.getIconForType = function(type) {
    const icons = {
        'request_created': 'add_circle',
        'status_changed': 'update',
        'document_ready': 'description',
        'admin_message': 'message',
        'system_alert': 'warning',
        'verification_result': 'verified'
    };
    return icons[type] || 'notifications';
};

// Mark as read
notificationSchema.methods.markAsRead = function() {
    this.read = true;
    this.readAt = new Date();
    return this.save();
};

module.exports = mongoose.model('Notification', notificationSchema);