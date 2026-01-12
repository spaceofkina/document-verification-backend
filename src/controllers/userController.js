const User = require('../models/User');
const DocumentRequest = require('../models/DocumentRequest');
const bcrypt = require('bcryptjs');

exports.getUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Get user's request stats
        const requestStats = await DocumentRequest.aggregate([
            { $match: { userId: user._id } },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);
        
        res.json({
            success: true,
            data: {
                user,
                stats: requestStats
            }
        });
    } catch (error) {
        console.error('Get user profile error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const updates = req.body;
        
        // Allowed fields for update
        const allowedUpdates = [
            'firstName', 'lastName', 'barangayName', 
            'contactNumber', 'address'
        ];
        
        // Filter updates
        const filteredUpdates = {};
        allowedUpdates.forEach(field => {
            if (updates[field] !== undefined) {
                filteredUpdates[field] = updates[field];
            }
        });
        
        // Update user
        const user = await User.findByIdAndUpdate(
            userId,
            { $set: filteredUpdates },
            { new: true, runValidators: true }
        ).select('-password');
        
        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: user
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Server error updating profile' });
    }
};

exports.changePassword = async (req, res) => {
    try {
        const userId = req.user.id;
        const { currentPassword, newPassword } = req.body;
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ 
                error: 'Please provide current and new password' 
            });
        }
        
        if (newPassword.length < 6) {
            return res.status(400).json({ 
                error: 'New password must be at least 6 characters' 
            });
        }
        
        // Get user with password
        const user = await User.findById(userId).select('+password');
        
        // Verify current password
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }
        
        // Update password
        user.password = newPassword;
        await user.save();
        
        res.json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Server error changing password' });
    }
};

exports.getNotifications = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Get recent requests with status changes
        const recentRequests = await DocumentRequest.find({
            userId,
            status: { $in: ['approved', 'declined', 'ready-to-claim'] },
            dateProcessed: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
        }).sort({ dateProcessed: -1 });
        
        // Format notifications
        const notifications = recentRequests.map(request => ({
            id: request._id,
            type: 'request_update',
            title: `Your ${request.documentType} request has been ${request.status}`,
            message: `Request ${request.requestId} is now ${request.status}`,
            documentType: request.documentType,
            status: request.status,
            date: request.dateProcessed,
            read: false,
            actionUrl: `/requests/${request._id}`
        }));
        
        res.json({
            success: true,
            data: notifications,
            count: notifications.length,
            unreadCount: notifications.filter(n => !n.read).length
        });
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};