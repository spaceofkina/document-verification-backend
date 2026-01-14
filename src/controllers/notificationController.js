const Notification = require('../models/Notification');
const User = require('../models/User');

// Get user notifications
exports.getUserNotifications = async (req, res) => {
    try {
        const userId = req.user.id;
        const { limit = 20, unreadOnly = false, type } = req.query;
        
        let query = { userId };
        
        if (unreadOnly === 'true') {
            query.read = false;
        }
        
        if (type) {
            query.type = type;
        }
        
        const notifications = await Notification.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .select('-__v');
        
        const unreadCount = await Notification.countDocuments({ 
            userId, 
            read: false 
        });
        
        res.json({
            success: true,
            data: notifications,
            meta: {
                total: notifications.length,
                unreadCount,
                hasMore: await Notification.countDocuments(query) > parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ error: 'Server error getting notifications' });
    }
};

// Mark notification as read
exports.markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        
        const notification = await Notification.findOne({
            _id: id,
            userId
        });
        
        if (!notification) {
            return res.status(404).json({ 
                error: 'Notification not found' 
            });
        }
        
        await notification.markAsRead();
        
        res.json({
            success: true,
            message: 'Notification marked as read',
            data: notification
        });
    } catch (error) {
        console.error('Mark as read error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Mark all notifications as read
exports.markAllAsRead = async (req, res) => {
    try {
        const userId = req.user.id;
        
        const result = await Notification.updateMany(
            { userId, read: false },
            { 
                $set: { 
                    read: true, 
                    readAt: new Date() 
                } 
            }
        );
        
        res.json({
            success: true,
            message: `${result.modifiedCount} notifications marked as read`,
            data: {
                markedCount: result.modifiedCount
            }
        });
    } catch (error) {
        console.error('Mark all as read error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Delete notification
exports.deleteNotification = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        
        const notification = await Notification.findOneAndDelete({
            _id: id,
            userId
        });
        
        if (!notification) {
            return res.status(404).json({ 
                error: 'Notification not found' 
            });
        }
        
        res.json({
            success: true,
            message: 'Notification deleted',
            data: notification
        });
    } catch (error) {
        console.error('Delete notification error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Clear all notifications
exports.clearAllNotifications = async (req, res) => {
    try {
        const userId = req.user.id;
        
        const result = await Notification.deleteMany({ userId });
        
        res.json({
            success: true,
            message: `${result.deletedCount} notifications cleared`,
            data: {
                deletedCount: result.deletedCount
            }
        });
    } catch (error) {
        console.error('Clear all notifications error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Create notification (admin only)
exports.createNotification = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ 
                error: 'Access denied. Admin only.' 
            });
        }
        
        const { userId, type, title, message, data, priority, actionUrl } = req.body;
        
        if (!userId || !type || !title || !message) {
            return res.status(400).json({ 
                error: 'Missing required fields: userId, type, title, message' 
            });
        }
        
        // Verify user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ 
                error: 'User not found' 
            });
        }
        
        const notification = await Notification.createNotification(
            userId, 
            type, 
            title, 
            message, 
            data, 
            priority, 
            actionUrl
        );
        
        res.status(201).json({
            success: true,
            message: 'Notification created',
            data: notification
        });
    } catch (error) {
        console.error('Create notification error:', error);
        res.status(500).json({ error: 'Server error creating notification' });
    }
};

// Get notification statistics
exports.getNotificationStats = async (req, res) => {
    try {
        const userId = req.user.id;
        
        const [
            total,
            unread,
            today,
            byType
        ] = await Promise.all([
            Notification.countDocuments({ userId }),
            Notification.countDocuments({ userId, read: false }),
            Notification.countDocuments({ 
                userId, 
                createdAt: { 
                    $gte: new Date(new Date().setHours(0, 0, 0, 0)) 
                } 
            }),
            Notification.aggregate([
                { $match: { userId } },
                { $group: { 
                    _id: '$type', 
                    count: { $sum: 1 },
                    unread: { 
                        $sum: { $cond: [{ $eq: ['$read', false] }, 1, 0] } 
                    }
                }},
                { $sort: { count: -1 } }
            ])
        ]);
        
        res.json({
            success: true,
            data: {
                total,
                unread,
                today,
                byType,
                readPercentage: total > 0 ? ((total - unread) / total * 100).toFixed(1) : 0
            }
        });
    } catch (error) {
        console.error('Get notification stats error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};