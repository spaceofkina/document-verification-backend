const User = require('../models/User');
const DocumentRequest = require('../models/DocumentRequest');
const Notification = require('../models/Notification');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

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

// NEW: Get user dashboard overview
exports.getDashboardOverview = async (req, res) => {
    try {
        const userId = req.user.id;
        
        const [
            totalRequests,
            pendingRequests,
            approvedRequests,
            readyToClaim,
            claimedRequests,
            recentRequests,
            documentTypes
        ] = await Promise.all([
            DocumentRequest.countDocuments({ userId }),
            DocumentRequest.countDocuments({ 
                userId, 
                status: { $in: ['pending', 'under-review', 'verified'] } 
            }),
            DocumentRequest.countDocuments({ 
                userId, 
                status: 'approved' 
            }),
            DocumentRequest.countDocuments({ 
                userId, 
                status: 'ready-to-claim' 
            }),
            DocumentRequest.countDocuments({ 
                userId, 
                status: 'claimed' 
            }),
            DocumentRequest.find({ userId })
                .sort({ dateRequested: -1 })
                .limit(5)
                .select('documentType status dateRequested requestId trackingCode verificationResult.confidenceScore'),
            DocumentRequest.aggregate([
                { $match: { userId: mongoose.Types.ObjectId(userId) } },
                { $group: { 
                    _id: '$documentType', 
                    count: { $sum: 1 },
                    lastRequest: { $max: '$dateRequested' },
                    pending: { 
                        $sum: { 
                            $cond: [{ $in: ['$status', ['pending', 'under-review', 'verified']] }, 1, 0] 
                        } 
                    }
                }},
                { $sort: { count: -1 } }
            ])
        ]);
        
        // Get notification count
        const notificationCount = await Notification.countDocuments({ 
            userId, 
            read: false 
        });
        
        res.json({
            success: true,
            data: {
                stats: {
                    total: totalRequests,
                    pending: pendingRequests,
                    approved: approvedRequests,
                    readyToClaim: readyToClaim,
                    claimed: claimedRequests
                },
                recentRequests: recentRequests.map(req => ({
                    id: req._id,
                    documentType: req.documentType,
                    status: req.status,
                    dateRequested: req.dateRequested,
                    requestId: req.requestId,
                    trackingCode: req.trackingCode,
                    confidence: req.verificationResult?.confidenceScore ? 
                        Math.round(req.verificationResult.confidenceScore * 100) + '%' : 'N/A'
                })),
                documentTypes,
                notificationCount,
                quickActions: [
                    { 
                        label: 'Request New Document', 
                        action: 'request', 
                        url: '/request',
                        icon: 'add_circle',
                        color: 'primary'
                    },
                    { 
                        label: 'View All Requests', 
                        action: 'view_all', 
                        url: '/my-requests',
                        icon: 'list_alt',
                        color: 'secondary'
                    },
                    { 
                        label: 'Check Eligibility', 
                        action: 'eligibility', 
                        url: '/eligibility',
                        icon: 'check_circle',
                        color: 'success'
                    },
                    { 
                        label: 'Update Profile', 
                        action: 'profile', 
                        url: '/profile',
                        icon: 'person',
                        color: 'info'
                    }
                ],
                tips: [
                    'Upload clear images of your ID for faster verification',
                    'Check your request eligibility before submitting',
                    'Visit Brgy. Lajong office to claim ready documents',
                    'Keep your contact information updated'
                ]
            }
        });
    } catch (error) {
        console.error('Get dashboard overview error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// NEW: Get request eligibility for all document types
exports.getRequestEligibility = async (req, res) => {
    try {
        const userId = req.user.id;
        const documentTypes = [
            'Certificate of Residency',
            'Barangay Clearance',
            'First-Time Job Seeker Certificate',
            'Certificate of Indigency',
            'Good Moral Certificate',
            'Barangay Permit'
        ];
        
        const eligibility = [];
        
        for (const docType of documentTypes) {
            // Check for active requests
            const activeRequests = await DocumentRequest.find({
                userId,
                documentType: docType,
                status: { $in: ['pending', 'under-review', 'verified', 'ready-to-claim', 'approved'] }
            }).sort({ dateRequested: -1 });
            
            const canRequest = activeRequests.length === 0;
            
            // Check for Certificate of Indigency frequency
            let frequencyRestriction = null;
            if (docType === 'Certificate of Indigency' && !canRequest) {
                // Check last claimed/declined
                const lastRequest = await DocumentRequest.findOne({
                    userId,
                    documentType: docType,
                    status: { $in: ['claimed', 'declined'] }
                }).sort({ dateRequested: -1 });
                
                if (lastRequest) {
                    const daysSince = Math.floor((new Date() - lastRequest.dateRequested) / (1000 * 60 * 60 * 24));
                    frequencyRestriction = {
                        canRequest: daysSince >= 30,
                        daysSince,
                        daysRemaining: Math.max(0, 30 - daysSince),
                        lastRequestDate: lastRequest.dateRequested.toISOString().split('T')[0],
                        nextEligibleDate: new Date(lastRequest.dateRequested.getTime() + 30 * 24 * 60 * 60 * 1000)
                            .toISOString().split('T')[0]
                    };
                }
            }
            
            eligibility.push({
                documentType: docType,
                canRequest: canRequest && (!frequencyRestriction || frequencyRestriction.canRequest),
                activeRequests: activeRequests.length,
                frequencyRestriction,
                currentStatus: activeRequests.length > 0 ? activeRequests[0].status : null,
                lastRequestDate: activeRequests.length > 0 ? activeRequests[0].dateRequested.toISOString().split('T')[0] : null,
                requestId: activeRequests.length > 0 ? activeRequests[0].requestId : null,
                message: activeRequests.length > 0 ? 
                    `You have ${activeRequests.length} active ${docType} request(s)` :
                    frequencyRestriction && !frequencyRestriction.canRequest ?
                    `Certificate of Indigency: Can request again in ${frequencyRestriction.daysRemaining} days` :
                    'Available for request',
                requestUrl: `/request/${encodeURIComponent(docType)}`,
                statusUrl: activeRequests.length > 0 ? `/request/${activeRequests[0]._id}` : null
            });
        }
        
        res.json({
            success: true,
            data: {
                eligibility,
                summary: {
                    canRequest: eligibility.filter(e => e.canRequest).length,
                    cannotRequest: eligibility.filter(e => !e.canRequest).length,
                    totalTypes: eligibility.length
                }
            }
        });
    } catch (error) {
        console.error('Get request eligibility error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// NEW: Get user activity log
exports.getActivityLog = async (req, res) => {
    try {
        const userId = req.user.id;
        const { limit = 20, page = 1 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const [requests, total] = await Promise.all([
            DocumentRequest.find({ userId })
                .sort({ dateRequested: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .select('documentType status dateRequested requestId trackingCode verificationResult.adminNotes'),
            DocumentRequest.countDocuments({ userId })
        ]);
        
        const activityLog = requests.map(request => ({
            id: request._id,
            type: 'document_request',
            title: `${request.documentType} Request`,
            description: `Status: ${request.status}`,
            date: request.dateRequested,
            requestId: request.requestId,
            trackingCode: request.trackingCode,
            status: request.status,
            notes: request.verificationResult?.adminNotes || null,
            icon: this.getIconForStatus(request.status)
        }));
        
        res.json({
            success: true,
            data: activityLog,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Get activity log error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Helper: Get icon for status
exports.getIconForStatus = function(status) {
    const icons = {
        'pending': 'schedule',
        'under-review': 'search',
        'verified': 'verified',
        'approved': 'check_circle',
        'declined': 'cancel',
        'ready-to-claim': 'description',
        'claimed': 'done_all'
    };
    return icons[status] || 'notifications';
};