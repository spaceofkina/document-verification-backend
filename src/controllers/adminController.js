const DocumentRequest = require('../models/DocumentRequest');
const User = require('../models/User');
const templateService = require('../services/templateService');
const moment = require('moment');
const path = require('path');
const fs = require('fs').promises;

// === ORIGINAL METHODS (Keep all existing) ===
exports.getAllRequests = async (req, res) => {
    try {
        const {
            status,
            documentType,
            startDate,
            endDate,
            page = 1,
            limit = 10,
            sortBy = 'dateRequested',
            sortOrder = 'desc'
        } = req.query;
        
        let query = {};
        
        // Apply filters
        if (status) query.status = status;
        if (documentType) query.documentType = documentType;
        if (startDate || endDate) {
            query.dateRequested = {};
            if (startDate) query.dateRequested.$gte = new Date(startDate);
            if (endDate) query.dateRequested.$lte = new Date(endDate);
        }
        
        // Sort
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
        
        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const [requests, total] = await Promise.all([
            DocumentRequest.find(query)
                .populate('userId', 'firstName lastName email')
                .sort(sort)
                .skip(skip)
                .limit(parseInt(limit)),
            DocumentRequest.countDocuments(query)
        ]);
        
        res.json({
            success: true,
            data: requests,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Get all requests error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getRequestDetails = async (req, res) => {
    try {
        const { id } = req.params;
        
        const request = await DocumentRequest.findById(id)
            .populate('userId', 'firstName lastName email contactNumber address')
            .populate('adminId', 'firstName lastName');
        
        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }
        
        // Prepare response with secure file paths
        const requestData = request.toObject();
        
        // Convert file paths to downloadable URLs
        requestData.attachments = requestData.attachments.map(att => ({
            ...att,
            downloadUrl: `/api/admin/requests/${id}/attachments/${att.filename}`
        }));
        
        // Add PDF preview URL
        requestData.pdfPreviewUrl = `/api/admin/requests/${id}/view-pdf`;
        requestData.pdfDownloadUrl = `/api/admin/requests/${id}/download-pdf`;
        
        res.json({
            success: true,
            data: requestData
        });
    } catch (error) {
        console.error('Get request details error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.updateRequestStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, adminNotes } = req.body;
        const adminId = req.user.id;
        
        // Validate status
        const validStatuses = [
            'verified', 'failed', 'approved', 
            'declined', 'ready-to-claim'
        ];
        
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ 
                error: 'Invalid status' 
            });
        }
        
        const request = await DocumentRequest.findById(id);
        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }
        
        // Update request
        request.status = status;
        request.adminNotes = adminNotes;
        request.adminId = adminId;
        request.dateProcessed = new Date();
        
        await request.save();
        
        res.json({
            success: true,
            message: `Request ${status} successfully`,
            data: request
        });
    } catch (error) {
        console.error('Update request status error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.verifyDocument = async (req, res) => {
    try {
        const { id } = req.params;
        const { verificationStatus, notes } = req.body;
        const adminId = req.user.id;
        
        const request = await DocumentRequest.findById(id);
        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }
        
        // Update verification
        request.verificationResult.isVerified = verificationStatus === 'verified';
        request.verificationResult.verificationDate = new Date();
        
        if (verificationStatus === 'verified') {
            request.status = 'verified';
        } else {
            request.status = 'failed';
            request.verificationResult.mismatchDetails = notes || 'Manual verification failed';
        }
        
        request.adminId = adminId;
        request.adminNotes = notes;
        
        await request.save();
        
        res.json({
            success: true,
            message: `Document ${verificationStatus}`,
            data: request
        });
    } catch (error) {
        console.error('Verify document error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getDashboardStats = async (req, res) => {
    try {
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        
        const [
            totalRequests,
            pendingRequests,
            approvedRequests,
            declinedRequests,
            monthlyRequests,
            weeklyRequests,
            documentTypeStats,
            recentRequests
        ] = await Promise.all([
            DocumentRequest.countDocuments(),
            DocumentRequest.countDocuments({ status: { $in: ['pending', 'under-review'] } }),
            DocumentRequest.countDocuments({ status: 'approved' }),
            DocumentRequest.countDocuments({ status: 'declined' }),
            DocumentRequest.countDocuments({ dateRequested: { $gte: startOfMonth } }),
            DocumentRequest.countDocuments({ dateRequested: { $gte: startOfWeek } }),
            DocumentRequest.aggregate([
                { $group: { _id: '$documentType', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]),
            DocumentRequest.find()
                .populate('userId', 'firstName lastName')
                .sort({ dateRequested: -1 })
                .limit(10)
        ]);
        
        res.json({
            success: true,
            data: {
                totalRequests,
                pendingRequests,
                approvedRequests,
                declinedRequests,
                monthlyRequests,
                weeklyRequests,
                documentTypeStats,
                recentRequests,
                timestamp: new Date()
            }
        });
    } catch (error) {
        console.error('Get dashboard stats error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// === UPDATED: Generate Document Preview (Now uses template files) ===
exports.generateDocumentPreview = async (req, res) => {
    try {
        const { id } = req.params;
        const { mode = 'preview' } = req.query; // 'preview' or 'download'
        
        const request = await DocumentRequest.findById(id)
            .populate('userId', 'firstName lastName email contactNumber address');
        
        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }
        
        // Map request type to template name
        const templateMapping = {
            'Barangay Clearance': 'barangay_clearance',
            'Certificate of Residency': 'residency_certificate',
            'Certificate of Indigency': 'certificate_of_indigency',
            'Good Moral Certificate': 'good_moral_certificate',
            'First Time Job Seeker Certificate': 'first_time_job_seeker_certificate',
            'Business Permit': 'business_permit'
        };
        
        const templateName = templateMapping[request.documentType] || 'barangay_clearance';
        
        // Prepare data for template
        const templateData = {
            requestDetails: request.toObject(),
            userInfo: {
                fullName: `${request.userId?.firstName || ''} ${request.userId?.lastName || ''}`.trim(),
                address: request.userId?.address || request.permanentAddress,
                contactNumber: request.userId?.contactNumber || request.cellphoneNumber
            },
            documentType: request.documentType,
            includeSignature: true
        };
        
        // Generate PDF from template
        const pdfBuffer = await templateService.generatePDFFromTemplate(templateName, templateData);
        
        // Save generated PDF
        const savedFile = await templateService.saveGeneratedPDF(pdfBuffer, request.requestId);
        
        // Update request with generated PDF info
        request.generatedDocument = savedFile;
        await request.save();
        
        // Set response headers
        if (mode === 'download') {
            res.set({
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${templateName}_${request.requestId}.pdf"`,
                'Content-Length': pdfBuffer.length
            });
        } else {
            // Preview mode (inline)
            res.set({
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="preview_${request.requestId}.pdf"`,
                'Content-Length': pdfBuffer.length
            });
        }
        
        res.send(pdfBuffer);
        
    } catch (error) {
        console.error('Generate document preview error:', error);
        res.status(500).json({ 
            error: 'Server error generating document',
            details: error.message 
        });
    }
};

// === NEW: View PDF (Inline in browser) ===
exports.viewPDF = async (req, res) => {
    try {
        const { id } = req.params;
        
        const request = await DocumentRequest.findById(id)
            .populate('userId', 'firstName lastName');
        
        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }
        
        // Check if PDF was already generated
        let pdfBuffer;
        
        if (request.generatedDocument && request.generatedDocument.filePath) {
            try {
                // Read existing generated PDF
                pdfBuffer = await fs.readFile(request.generatedDocument.filePath);
            } catch (error) {
                console.log('Existing PDF not found, generating new one');
                // Generate new PDF
                return exports.generateDocumentPreview(req, res);
            }
        } else {
            // Generate new PDF
            return exports.generateDocumentPreview(req, res);
        }
        
        // Send as inline PDF for viewing
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="${request.documentType.replace(/\s+/g, '_')}_${request.requestId}.pdf"`,
            'Content-Length': pdfBuffer.length,
            'X-Generated-At': request.generatedDocument.generatedAt || new Date()
        });
        
        res.send(pdfBuffer);
        
    } catch (error) {
        console.error('View PDF error:', error);
        res.status(500).json({ error: 'Server error viewing PDF' });
    }
};

// === NEW: Download PDF ===
exports.downloadPDF = async (req, res) => {
    try {
        const { id } = req.params;
        
        const request = await DocumentRequest.findById(id);
        
        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }
        
        // Check if PDF was already generated
        if (!request.generatedDocument || !request.generatedDocument.filePath) {
            // Generate PDF first
            req.query = { mode: 'download' };
            return exports.generateDocumentPreview(req, res);
        }
        
        const filePath = request.generatedDocument.filePath;
        const fileName = request.generatedDocument.fileName || 
                        `${request.documentType.replace(/\s+/g, '_')}_${request.requestId}.pdf`;
        
        // Check if file exists
        try {
            await fs.access(filePath);
        } catch (error) {
            // Regenerate if file not found
            req.query = { mode: 'download' };
            return exports.generateDocumentPreview(req, res);
        }
        
        // Download the file
        res.download(filePath, fileName, (error) => {
            if (error) {
                console.error('Download PDF error:', error);
                res.status(500).json({ error: 'Error downloading file' });
            }
        });
        
    } catch (error) {
        console.error('Download PDF error:', error);
        res.status(500).json({ error: 'Server error downloading PDF' });
    }
};

// === NEW: Get admin notifications ===
exports.getAdminNotifications = async (req, res) => {
    try {
        const [
            newRequests,
            pendingVerification,
            readyToClaim,
            recentActivity
        ] = await Promise.all([
            DocumentRequest.countDocuments({ 
                status: 'pending',
                dateRequested: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            }),
            DocumentRequest.countDocuments({ 
                status: { $in: ['under-review', 'verified'] } 
            }),
            DocumentRequest.countDocuments({ 
                status: 'ready-to-claim' 
            }),
            DocumentRequest.find()
                .populate('userId', 'firstName lastName email')
                .sort({ dateRequested: -1 })
                .limit(10)
                .select('documentType status dateRequested requestId trackingCode')
        ]);
        
        const notifications = [];
        
        if (newRequests > 0) {
            notifications.push({
                type: 'new_requests',
                title: 'New Requests',
                message: `${newRequests} new document requests today`,
                priority: 'high',
                actionUrl: '/admin/requests?status=pending',
                icon: 'add_circle',
                timestamp: new Date()
            });
        }
        
        if (pendingVerification > 0) {
            notifications.push({
                type: 'pending_verification',
                title: 'Pending Verification',
                message: `${pendingVerification} documents need verification`,
                priority: 'medium',
                actionUrl: '/admin/requests?status=under-review',
                icon: 'search',
                timestamp: new Date()
            });
        }
        
        if (readyToClaim > 0) {
            notifications.push({
                type: 'ready_to_claim',
                title: 'Ready for Claiming',
                message: `${readyToClaim} documents are ready to be claimed`,
                priority: 'medium',
                actionUrl: '/admin/requests?status=ready-to-claim',
                icon: 'description',
                timestamp: new Date()
            });
        }
        
        res.json({
            success: true,
            data: {
                notifications,
                counts: {
                    newRequests,
                    pendingVerification,
                    readyToClaim
                },
                recentActivity: recentActivity.map(activity => ({
                    id: activity._id,
                    userId: activity.userId?._id,
                    userName: activity.userId ? `${activity.userId.firstName} ${activity.userId.lastName}` : 'Unknown',
                    userEmail: activity.userId?.email,
                    documentType: activity.documentType,
                    status: activity.status,
                    dateRequested: activity.dateRequested,
                    requestId: activity.requestId,
                    trackingCode: activity.trackingCode
                }))
            }
        });
    } catch (error) {
        console.error('Get admin notifications error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// === NEW: Get user management ===
exports.getUsers = async (req, res) => {
    try {
        const { role, search, page = 1, limit = 20 } = req.query;
        
        let query = {};
        if (role) query.role = role;
        if (search) {
            query.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }
        
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const [users, total] = await Promise.all([
            User.find(query)
                .select('-password')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            User.countDocuments(query)
        ]);
        
        // Get request counts for each user
        const usersWithStats = await Promise.all(
            users.map(async (user) => {
                const [requestCount, pendingCount, claimedCount] = await Promise.all([
                    DocumentRequest.countDocuments({ userId: user._id }),
                    DocumentRequest.countDocuments({ 
                        userId: user._id,
                        status: { $in: ['pending', 'under-review', 'verified', 'ready-to-claim'] }
                    }),
                    DocumentRequest.countDocuments({ 
                        userId: user._id,
                        status: 'claimed'
                    })
                ]);
                
                return {
                    ...user.toObject(),
                    requestCount,
                    pendingCount,
                    claimedCount,
                    lastRequest: await DocumentRequest.findOne({ userId: user._id })
                        .sort({ dateRequested: -1 })
                        .select('dateRequested documentType status')
                };
            })
        );
        
        res.json({
            success: true,
            data: usersWithStats,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            },
            summary: {
                totalUsers: total,
                adminCount: await User.countDocuments({ role: 'admin' }),
                staffCount: await User.countDocuments({ role: 'staff' }),
                userCount: await User.countDocuments({ role: 'user' })
            }
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// === NEW: Update user (admin only) ===
exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const adminId = req.user.id;
        
        // Allowed fields for admin update
        const allowedUpdates = [
            'firstName', 'lastName', 'barangayName', 
            'contactNumber', 'address', 'role', 'isActive'
        ];
        
        // Filter updates
        const filteredUpdates = {};
        allowedUpdates.forEach(field => {
            if (updates[field] !== undefined) {
                filteredUpdates[field] = updates[field];
            }
        });
        
        // Prevent admin from removing all admins
        if (filteredUpdates.role && filteredUpdates.role !== 'admin') {
            const adminCount = await User.countDocuments({ role: 'admin' });
            const user = await User.findById(id);
            
            if (user.role === 'admin' && adminCount <= 1) {
                return res.status(400).json({
                    error: 'Cannot remove the only admin account',
                    message: 'There must be at least one admin account'
                });
            }
        }
        
        // Update user
        const user = await User.findByIdAndUpdate(
            id,
            { 
                $set: filteredUpdates,
                $addToSet: { 
                    updatedBy: { 
                        adminId, 
                        date: new Date(), 
                        changes: Object.keys(filteredUpdates) 
                    } 
                }
            },
            { new: true, runValidators: true }
        ).select('-password');
        
        res.json({
            success: true,
            message: 'User updated successfully',
            data: user,
            changes: Object.keys(filteredUpdates)
        });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Server error updating user' });
    }
};

// === NEW: Create user notification (admin to user) ===
exports.createUserNotification = async (req, res) => {
    try {
        const { userId } = req.params;
        const { type, title, message, priority, actionUrl } = req.body;
        
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const Notification = require('../models/Notification');
        const notification = await Notification.createNotification(
            userId,
            type || 'admin_message',
            title,
            message,
            { adminId: req.user.id },
            priority || 'medium',
            actionUrl
        );
        
        res.status(201).json({
            success: true,
            message: 'Notification sent to user',
            data: notification
        });
    } catch (error) {
        console.error('Create user notification error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// === NEW: Get admin dashboard overview ===
exports.getAdminDashboard = async (req, res) => {
    try {
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        
        const [
            totalRequests,
            pendingRequests,
            verifiedRequests,
            readyToClaim,
            claimedRequests,
            monthlyRequests,
            weeklyRequests,
            documentTypeStats,
            userStats,
            recentActivity
        ] = await Promise.all([
            DocumentRequest.countDocuments(),
            DocumentRequest.countDocuments({ status: { $in: ['pending', 'under-review'] } }),
            DocumentRequest.countDocuments({ status: 'verified' }),
            DocumentRequest.countDocuments({ status: 'ready-to-claim' }),
            DocumentRequest.countDocuments({ status: 'claimed' }),
            DocumentRequest.countDocuments({ dateRequested: { $gte: startOfMonth } }),
            DocumentRequest.countDocuments({ dateRequested: { $gte: startOfWeek } }),
            DocumentRequest.aggregate([
                { 
                    $group: { 
                        _id: '$documentType', 
                        total: { $sum: 1 },
                        pending: { 
                            $sum: { $cond: [{ $in: ['$status', ['pending', 'under-review']] }, 1, 0] } 
                        },
                        ready: { 
                            $sum: { $cond: [{ $eq: ['$status', 'ready-to-claim'] }, 1, 0] } 
                        },
                        claimed: { 
                            $sum: { $cond: [{ $eq: ['$status', 'claimed'] }, 1, 0] } 
                        }
                    } 
                },
                { $sort: { total: -1 } }
            ]),
            User.aggregate([
                { $group: { _id: '$role', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]),
            DocumentRequest.find()
                .populate('userId', 'firstName lastName email')
                .sort({ dateRequested: -1 })
                .limit(10)
        ]);
        
        res.json({
            success: true,
            data: {
                requestStats: {
                    total: totalRequests,
                    pending: pendingRequests,
                    verified: verifiedRequests,
                    readyToClaim: readyToClaim,
                    claimed: claimedRequests,
                    monthly: monthlyRequests,
                    weekly: weeklyRequests
                },
                documentTypeStats,
                userStats,
                recentActivity: recentActivity.map(activity => ({
                    id: activity._id,
                    user: activity.userId ? {
                        name: `${activity.userId.firstName} ${activity.userId.lastName}`,
                        email: activity.userId.email
                    } : null,
                    documentType: activity.documentType,
                    status: activity.status,
                    dateRequested: activity.dateRequested,
                    requestId: activity.requestId,
                    trackingCode: activity.trackingCode
                })),
                quickActions: [
                    { label: 'View All Requests', action: 'requests', url: '/admin/requests', icon: 'list_alt' },
                    { label: 'User Management', action: 'users', url: '/admin/users', icon: 'people' },
                    { label: 'Generate Reports', action: 'reports', url: '/admin/reports', icon: 'assessment' },
                    { label: 'System Settings', action: 'settings', url: '/admin/settings', icon: 'settings' }
                ]
            }
        });
    } catch (error) {
        console.error('Get admin dashboard error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// === NEW: Get Available Templates ===
exports.getAvailableTemplates = async (req, res) => {
    try {
        const templates = await templateService.getAvailableTemplates();
        
        res.json({
            success: true,
            count: templates.length,
            templates: templates
        });
    } catch (error) {
        console.error('Get templates error:', error);
        res.status(500).json({ error: 'Server error getting templates' });
    }
};

// === NEW: Preview Template (without data) ===
exports.previewTemplate = async (req, res) => {
    try {
        const { templateName } = req.params;
        
        const pdfBuffer = await templateService.previewTemplate(templateName);
        
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="template_${templateName}.pdf"`,
            'Content-Length': pdfBuffer.length
        });
        
        res.send(pdfBuffer);
        
    } catch (error) {
        console.error('Preview template error:', error);
        res.status(500).json({ 
            error: 'Template preview error',
            message: error.message 
        });
    }
};

// === ORIGINAL: Download Attachment ===
exports.downloadAttachment = async (req, res) => {
    try {
        const { id, filename } = req.params;
        
        const request = await DocumentRequest.findById(id);
        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }
        
        const attachment = request.attachments.find(att => att.filename === filename);
        if (!attachment) {
            return res.status(404).json({ error: 'Attachment not found' });
        }
        
        const filePath = path.join(__dirname, '../../', attachment.path);
        
        // Check if file exists
        try {
            await fs.access(filePath);
        } catch (error) {
            return res.status(404).json({ error: 'File not found on server' });
        }
        
        res.download(filePath, attachment.filename);
    } catch (error) {
        console.error('Download attachment error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};