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