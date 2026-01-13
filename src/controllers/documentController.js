const DocumentRequest = require('../models/DocumentRequest');
const User = require('../models/User');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

// Philippine document types
const PHILIPPINE_DOCUMENT_TYPES = {
    REQUEST_TYPES: [
        'Certificate of Residency',
        'Barangay Clearance',
        'First-Time Job Seeker Certificate',
        'Certificate of Indigency',
        'Good Moral Certificate',
        'Barangay Permit'
    ]
};

// Generate PDF document
const generatePDFDocument = (requestData, userData) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50 });
            const buffers = [];
            
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfData = Buffer.concat(buffers);
                resolve(pdfData);
            });
            
            // Header
            doc.fontSize(20)
               .font('Helvetica-Bold')
               .text('BARANGAY LAJONG', { align: 'center' });
            
            doc.fontSize(14)
               .font('Helvetica')
               .text('Municipality of Bulan, Province of Sorsogon', { align: 'center' })
               .moveDown();
            
            // Document Title
            doc.fontSize(18)
               .font('Helvetica-Bold')
               .text(requestData.documentType.toUpperCase(), { align: 'center' })
               .moveDown(2);
            
            // Document Number
            doc.fontSize(12)
               .font('Helvetica')
               .text(`Request ID: ${requestData.requestId}`)
               .text(`Tracking Code: ${requestData.trackingCode}`)
               .text(`Date Issued: ${new Date().toLocaleDateString('en-PH')}`)
               .moveDown();
            
            // Line
            doc.moveTo(50, doc.y)
               .lineTo(550, doc.y)
               .stroke()
               .moveDown();
            
            // TO WHOM IT MAY CONCERN
            doc.fontSize(12)
               .font('Helvetica')
               .text('TO WHOM IT MAY CONCERN:', { underline: true })
               .moveDown();
            
            // Body
            const bodyText = `
This is to certify that ${requestData.fullName}, of legal age, ${requestData.employmentStatus.toLowerCase()}, 
Filipino, and a bonafide resident of ${requestData.permanentAddress}, Barangay Lajong, Bulan, Sorsogon.

This certification is issued upon the request of ${requestData.fullName.split(' ')[0]} for ${requestData.purpose.toLowerCase()}.

This certification is valid for thirty (30) days from the date of issuance unless sooner revoked.

Issued this ${new Date().getDate()}th day of ${new Date().toLocaleString('en-US', { month: 'long' })}, ${new Date().getFullYear()} at Barangay Lajong, Bulan, Sorsogon.
            `;
            
            doc.fontSize(12)
               .font('Helvetica')
               .text(bodyText, { align: 'justify' })
               .moveDown(3);
            
            // Signature area
            doc.fontSize(12)
               .text('___________________________', { align: 'right' })
               .font('Helvetica-Bold')
               .text('HON. BARANGAY CAPTAIN', { align: 'right' })
               .font('Helvetica')
               .text('Barangay Lajong', { align: 'right' })
               .moveDown();
            
            // Verification info
            doc.fontSize(8)
               .fillColor('gray')
               .text(`Verified via: ${requestData.verificationResult?.detectedIdType || 'Manual'} | Confidence: ${requestData.verificationResult?.confidenceScore ? Math.round(requestData.verificationResult.confidenceScore * 100) + '%' : 'N/A'} | Request ID: ${requestData.requestId}`, { align: 'center' });
            
            doc.end();
        } catch (error) {
            reject(error);
        }
    });
};

// Get available document types
exports.getDocumentTypes = async (req, res) => {
    try {
        res.json({
            success: true,
            system: 'Barangay Lajong Document Request System',
            requestTypes: PHILIPPINE_DOCUMENT_TYPES.REQUEST_TYPES,
            rules: [
                'Cannot request same document type if you have pending/ready-to-claim request',
                'Can request different document types even if others are pending',
                'Can re-request same type only after claimed or declined',
                'Certificate of Indigency: Minimum 30 days between requests'
            ]
        });
    } catch (error) {
        console.error('Get document types error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Check if user can request specific document type
exports.checkRequestEligibility = async (req, res) => {
    try {
        const userId = req.user.id;
        const { documentType } = req.params;
        
        if (!PHILIPPINE_DOCUMENT_TYPES.REQUEST_TYPES.includes(documentType)) {
            return res.status(400).json({
                error: 'Invalid document type',
                validTypes: PHILIPPINE_DOCUMENT_TYPES.REQUEST_TYPES
            });
        }
        
        // Check for active requests of same type
        const activeRequests = await DocumentRequest.find({
            userId,
            documentType,
            status: { $in: ['pending', 'under-review', 'verified', 'ready-to-claim', 'approved'] }
        }).sort({ dateRequested: -1 });
        
        // Check for previous claimed/declined requests
        const previousRequests = await DocumentRequest.find({
            userId,
            documentType,
            status: { $in: ['claimed', 'declined'] }
        }).sort({ dateRequested: -1 }).limit(1);
        
        let canRequest = true;
        let message = 'You can request this document';
        let restrictions = [];
        let existingRequest = null;
        let previousRequest = null;
        
        if (activeRequests.length > 0) {
            canRequest = false;
            existingRequest = activeRequests[0];
            message = `You already have a pending ${documentType} request`;
            restrictions.push('Wait for current request to be processed');
            restrictions.push('You can request other document types');
        }
        
        if (previousRequests.length > 0) {
            previousRequest = previousRequests[0];
            const daysSince = Math.floor((new Date() - previousRequest.dateRequested) / (1000 * 60 * 60 * 24));
            
            if (documentType === 'Certificate of Indigency' && daysSince < 30) {
                canRequest = false;
                message = `Certificate of Indigency can only be requested every 30 days`;
                restrictions.push(`Last requested ${daysSince} days ago`);
                restrictions.push(`Can request again in ${30 - daysSince} days`);
            }
        }
        
        // Check if user can request other types
        const otherActiveRequests = await DocumentRequest.find({
            userId,
            documentType: { $ne: documentType },
            status: { $in: ['pending', 'under-review', 'verified', 'ready-to-claim', 'approved'] }
        });
        
        res.json({
            success: true,
            canRequest,
            message,
            documentType,
            restrictions,
            existingRequest: existingRequest ? {
                requestId: existingRequest.requestId,
                status: existingRequest.status,
                dateRequested: existingRequest.dateRequested,
                ageInDays: Math.floor((new Date() - existingRequest.dateRequested) / (1000 * 60 * 60 * 24))
            } : null,
            previousRequest: previousRequest ? {
                requestId: previousRequest.requestId,
                status: previousRequest.status,
                dateRequested: previousRequest.dateRequested,
                daysSince: Math.floor((new Date() - previousRequest.dateRequested) / (1000 * 60 * 60 * 24))
            } : null,
            canRequestOtherTypes: otherActiveRequests.length === 0 || true, // Always true for different types
            otherActiveRequestsCount: otherActiveRequests.length
        });
        
    } catch (error) {
        console.error('Check eligibility error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Create document request with validation
exports.createDocumentRequest = async (req, res) => {
    try {
        const userId = req.user.id;
        const {
            documentType,
            fullName,
            permanentAddress,
            purpose,
            employmentStatus,
            cellphoneNumber,
            proceedAnyway = 'false'
        } = req.body;

        // Validate document type
        if (!PHILIPPINE_DOCUMENT_TYPES.REQUEST_TYPES.includes(documentType)) {
            return res.status(400).json({
                error: 'Invalid document type',
                validTypes: PHILIPPINE_DOCUMENT_TYPES.REQUEST_TYPES
            });
        }

        // ✅ VALIDATION 1: Check for active requests of same type
        const activeRequests = await DocumentRequest.find({
            userId,
            documentType,
            status: { $in: ['pending', 'under-review', 'verified', 'ready-to-claim', 'approved'] }
        });

        if (activeRequests.length > 0) {
            const existingRequest = activeRequests[0];
            return res.status(400).json({
                error: 'Cannot request same document type',
                message: `You already have a pending ${documentType} request`,
                existingRequest: {
                    requestId: existingRequest.requestId,
                    status: existingRequest.status,
                    dateRequested: existingRequest.dateRequested.toISOString().split('T')[0],
                    ageInDays: Math.floor((new Date() - existingRequest.dateRequested) / (1000 * 60 * 60 * 24)),
                    actionRequired: existingRequest.status === 'ready-to-claim' ? 
                        'Please claim your document at Brgy office' :
                        'Wait for your current request to be processed'
                },
                allowedActions: [
                    'You can request other document types',
                    'You can check status of existing request',
                    'Once claimed or declined, you can request again'
                ]
            });
        }

        // ✅ VALIDATION 2: Check frequency for Certificate of Indigency
        if (documentType === 'Certificate of Indigency') {
            const previousIndigencyRequests = await DocumentRequest.find({
                userId,
                documentType: 'Certificate of Indigency',
                status: { $in: ['claimed', 'declined'] }
            }).sort({ dateRequested: -1 }).limit(1);

            if (previousIndigencyRequests.length > 0) {
                const previous = previousIndigencyRequests[0];
                const daysSince = Math.floor((new Date() - previous.dateRequested) / (1000 * 60 * 60 * 24));
                
                if (daysSince < 30) {
                    const canRequestDate = new Date(previous.dateRequested.getTime() + 30 * 24 * 60 * 60 * 1000);
                    return res.status(400).json({
                        error: 'Request frequency limit',
                        message: `Certificate of Indigency can only be requested every 30 days`,
                        details: {
                            lastRequested: previous.dateRequested.toISOString().split('T')[0],
                            daysSince: daysSince,
                            canRequestAgain: canRequestDate.toISOString().split('T')[0],
                            daysRemaining: 30 - daysSince
                        },
                        note: 'This restriction applies only to Certificate of Indigency'
                    });
                }
            }
        }

        // Validate required fields
        if (!fullName || !permanentAddress || !purpose) {
            return res.status(400).json({ 
                error: 'Missing required fields: fullName, permanentAddress, purpose' 
            });
        }

        // Check if file was uploaded
        if (!req.file) {
            return res.status(400).json({ 
                error: 'Please upload your Philippine ID for verification' 
            });
        }

        // STEP 1: RUN REAL-TIME VERIFICATION
        let cnnResult, ocrResult;
        try {
            const cnnService = require('../services/cnnService');
            const ocrService = require('../services/ocrService');
            
            // Read uploaded file
            const imageBuffer = fs.readFileSync(req.file.path);
            
            // Run CNN classification
            cnnResult = await cnnService.classifyID(imageBuffer);
            
            // Run OCR extraction
            ocrResult = await ocrService.extractTextFromImage(imageBuffer, cnnResult.detectedIdType);
            
        } catch (verificationError) {
            console.error('Verification error:', verificationError);
            // Continue even if verification fails
            cnnResult = {
                detectedIdType: 'Manual Verification Needed',
                confidenceScore: 0,
                isRealCNN: false
            };
            ocrResult = { fields: {} };
        }

        // Calculate verification confidence
        const confidence = cnnResult.confidenceScore || 0;
        const confidencePercentage = Math.round(confidence * 100);
        const detectedIdType = cnnResult.detectedIdType || 'Unknown';
        
        // Determine confidence level
        const isHighConfidence = confidence > 0.7;
        const isMediumConfidence = confidence > 0.5;
        
        // STEP 2: DETERMINE IF USER NEEDS TO CONFIRM
        let needsUserConfirmation = false;
        let warningMessage = '';
        let userMessage = '';
        let verificationStatus = '';
        
        if (isHighConfidence) {
            verificationStatus = 'verified';
            userMessage = `✅ Verified as ${detectedIdType} (${confidencePercentage}% confidence)`;
        } else if (isMediumConfidence) {
            needsUserConfirmation = true;
            verificationStatus = 'under-review';
            warningMessage = `⚠️ Medium confidence: ${detectedIdType} (${confidencePercentage}% confidence)`;
            userMessage = 'Our system is not completely sure about your ID. Do you want to proceed?';
        } else {
            needsUserConfirmation = true;
            verificationStatus = 'under-review';
            warningMessage = `❌ Low confidence: ${detectedIdType} (${confidencePercentage}% confidence)`;
            userMessage = 'We could not verify your ID clearly. Please upload a clearer image or proceed for manual review.';
        }
        
        // Check if using simulation mode
        if (cnnResult.isRealCNN === false) {
            needsUserConfirmation = true;
            warningMessage = '⚠️ Using simulation mode. Real verification unavailable.';
            verificationStatus = 'needs-manual-review';
        }
        
        // STEP 3: CHECK IF USER DECIDED TO PROCEED ANYWAY
        const userConfirmed = proceedAnyway === 'true';
        
        // If needs confirmation but user hasn't confirmed yet, return confirmation request
        if (needsUserConfirmation && !userConfirmed) {
            return res.status(200).json({
                success: true,
                needsConfirmation: true,
                verificationResults: {
                    detectedIdType: detectedIdType,
                    confidencePercentage: confidencePercentage,
                    confidenceLevel: isHighConfidence ? 'High' : isMediumConfidence ? 'Medium' : 'Low',
                    status: verificationStatus,
                    warning: warningMessage,
                    userMessage: userMessage,
                    extractedFields: ocrResult.fields || {},
                    isRealCNN: cnnResult.isRealCNN || false,
                    recommendation: isMediumConfidence ? 
                        'You may proceed, but manual review may be required' :
                        'Please upload a clearer image for better verification'
                },
                message: 'Please confirm submission based on verification results',
                options: {
                    proceedAnyway: true,
                    uploadNew: true,
                    cancel: true
                }
            });
        }
        
        // STEP 4: CREATE REQUEST WITH VERIFICATION RESULTS
        const requestId = `BRGY${Date.now()}${Math.floor(Math.random() * 1000)}`;
        const trackingCode = `TRK${Date.now()}${Math.floor(Math.random() * 1000)}`;
        
        // Determine final status
        let finalStatus = 'pending';
        let adminViewStatus = '';
        
        if (isHighConfidence) {
            finalStatus = 'verified';
            adminViewStatus = '✅ Auto-verified by AI';
        } else if (userConfirmed) {
            finalStatus = 'pending';
            adminViewStatus = '⚠️ User proceeded despite low confidence';
        } else if (isMediumConfidence) {
            finalStatus = 'pending';
            adminViewStatus = '⚠️ Needs manual review (medium confidence)';
        } else {
            finalStatus = 'pending';
            adminViewStatus = '❌ Needs manual verification';
        }
        
        const documentRequest = new DocumentRequest({
            userId,
            requestId,
            documentType,
            fullName,
            permanentAddress,
            purpose,
            employmentStatus: employmentStatus || 'Unemployed',
            cellphoneNumber: cellphoneNumber || '',
            attachments: [{
                filename: req.file.originalname,
                path: req.file.path,
                verifiedType: detectedIdType,
                verificationConfidence: confidencePercentage
            }],
            status: finalStatus,
            trackingCode,
            verificationResult: {
                isVerified: isHighConfidence,
                confidenceScore: confidence,
                detectedIdType: detectedIdType,
                extractedText: ocrResult.fields || {},
                verificationDate: new Date(),
                userConfirmed: userConfirmed,
                warningMessage: warningMessage,
                algorithmStatus: verificationStatus,
                isRealCNN: cnnResult.isRealCNN || false,
                backendUsed: cnnResult.backend || 'Unknown'
            },
            adminNotes: adminViewStatus
        });

        await documentRequest.save();

        // STEP 5: RETURN FINAL RESPONSE
        let finalUserMessage = '';
        if (finalStatus === 'verified') {
            finalUserMessage = `✅ Success! Your ${documentType} request has been submitted and verified.`;
        } else {
            finalUserMessage = `📝 Your ${documentType} request has been submitted. Status: ${finalStatus}.`;
        }
        
        res.status(201).json({
            success: true,
            message: finalUserMessage,
            system: 'Barangay Lajong Document System',
            data: {
                requestId: documentRequest.requestId,
                trackingCode: documentRequest.trackingCode,
                documentType: documentRequest.documentType,
                status: documentRequest.status,
                verification: {
                    idType: detectedIdType,
                    confidence: confidencePercentage + '%',
                    confidenceLevel: isHighConfidence ? 'High' : isMediumConfidence ? 'Medium' : 'Low',
                    algorithmResult: verificationStatus,
                    userConfirmed: userConfirmed
                },
                dateRequested: documentRequest.dateRequested,
                restrictions: {
                    canRequestOtherTypes: true,
                    canRequestSameTypeAgain: 'Only after claimed or declined',
                    specialRules: documentType === 'Certificate of Indigency' ? 
                        'Minimum 30 days between requests' : 'None'
                }
            }
        });

    } catch (error) {
        console.error('Create document request error:', error);
        
        // Clean up uploaded file if error
        if (req.file && req.file.path) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (cleanupError) {
                console.error('Error cleaning up file:', cleanupError);
            }
        }
        
        res.status(500).json({ 
            error: 'Server error creating document request',
            details: error.message
        });
    }
};

// Get user's document requests (Resident Track Request)
exports.getUserRequests = async (req, res) => {
    try {
        const userId = req.user.id;
        const { status, documentType } = req.query;
        
        let query = { userId };
        if (status && status !== 'all') query.status = status;
        if (documentType && documentType !== 'all') query.documentType = documentType;
        
        const requests = await DocumentRequest.find(query)
            .sort({ dateRequested: -1 })
            .select('-attachments.path');
        
        // Get user's request statistics
        const requestStats = {
            total: await DocumentRequest.countDocuments({ userId }),
            pending: await DocumentRequest.countDocuments({ 
                userId, 
                status: { $in: ['pending', 'under-review', 'verified'] } 
            }),
            ready: await DocumentRequest.countDocuments({ 
                userId, 
                status: 'ready-to-claim' 
            }),
            claimed: await DocumentRequest.countDocuments({ 
                userId, 
                status: 'claimed' 
            }),
            declined: await DocumentRequest.countDocuments({ 
                userId, 
                status: 'declined' 
            })
        };
        
        // Check which document types user can request
        const allDocumentTypes = PHILIPPINE_DOCUMENT_TYPES.REQUEST_TYPES;
        const eligibleDocumentTypes = [];
        
        for (const docType of allDocumentTypes) {
            const activeRequests = await DocumentRequest.countDocuments({
                userId,
                documentType: docType,
                status: { $in: ['pending', 'under-review', 'verified', 'ready-to-claim', 'approved'] }
            });
            
            eligibleDocumentTypes.push({
                documentType: docType,
                canRequest: activeRequests === 0,
                activeRequests: activeRequests,
                note: activeRequests > 0 ? 
                    `You have ${activeRequests} active ${docType} request(s)` :
                    'You can request this document'
            });
        }
        
        res.json({
            success: true,
            system: 'Barangay Lajong Document Request System',
            stats: requestStats,
            eligibleDocumentTypes,
            count: requests.length,
            requests: requests.map(req => ({
                id: req._id,
                requestId: req.requestId,
                documentType: req.documentType,
                dateRequested: req.dateRequested.toISOString().split('T')[0],
                verificationResult: req.verificationResult?.algorithmStatus || 'pending',
                confidence: req.verificationResult?.confidenceScore ? 
                    Math.round(req.verificationResult.confidenceScore * 100) + '%' : 'N/A',
                status: req.status,
                trackingCode: req.trackingCode,
                purpose: req.purpose,
                canDownload: req.status === 'ready-to-claim' || req.status === 'claimed',
                canRequestAgain: req.status === 'claimed' || req.status === 'declined',
                daysOld: Math.floor((new Date() - req.dateRequested) / (1000 * 60 * 60 * 24))
            }))
        });
    } catch (error) {
        console.error('Get user requests error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get request details for View button
exports.getRequestDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role;
        
        // Build query based on role
        let query = { _id: id };
        if (userRole !== 'admin') {
            query.userId = userId;
        }
        
        const request = await DocumentRequest.findOne(query)
            .populate('userId', 'firstName lastName email barangayName contactNumber address');
        
        if (!request) {
            return res.status(404).json({ 
                error: 'Document request not found'
            });
        }
        
        // Get user info
        const user = request.userId || await User.findById(request.userId);
        
        // Format response
        const response = {
            success: true,
            system: 'Barangay Lajong Document Request System',
            requestInfo: {
                requestId: request.requestId,
                trackingCode: request.trackingCode,
                documentType: request.documentType,
                dateRequested: request.dateRequested.toISOString().split('T')[0],
                dateProcessed: request.dateProcessed ? request.dateProcessed.toISOString().split('T')[0] : null,
                dateClaimed: request.dateClaimed ? request.dateClaimed.toISOString().split('T')[0] : null,
                status: request.status,
                priority: request.priority,
                adminNotes: request.adminNotes
            },
            userInfo: {
                fullName: request.fullName || `${user?.firstName || ''} ${user?.lastName || ''}`,
                permanentAddress: request.permanentAddress || user?.address || '',
                employmentStatus: request.employmentStatus,
                cellphoneNumber: request.cellphoneNumber || user?.contactNumber || '',
                email: user?.email || '',
                barangay: user?.barangayName || 'Brgy Lajong'
            },
            requestData: {
                purpose: request.purpose
            },
            verification: {
                idType: request.verificationResult?.detectedIdType || 'Unknown',
                confidence: request.verificationResult?.confidenceScore ? 
                    Math.round(request.verificationResult.confidenceScore * 100) + '%' : 'N/A',
                status: request.verificationResult?.algorithmStatus || 'pending',
                verifiedOn: request.verificationResult?.verificationDate,
                warning: request.verificationResult?.warningMessage || '',
                userConfirmed: request.verificationResult?.userConfirmed || false,
                isRealCNN: request.verificationResult?.isRealCNN || false
            },
            attachments: request.attachments.map(att => ({
                filename: att.filename,
                verifiedType: att.verifiedType,
                confidence: att.verificationConfidence ? att.verificationConfidence + '%' : 'N/A',
                uploadDate: att.uploadDate.toISOString().split('T')[0]
            })),
            canGeneratePDF: ['verified', 'ready-to-claim', 'claimed', 'approved'].includes(request.status),
            canUpdateStatus: userRole === 'admin',
            statusOptions: userRole === 'admin' ? 
                ['pending', 'verified', 'ready-to-claim', 'claimed', 'declined'] : 
                []
        };
        
        res.json(response);
    } catch (error) {
        console.error('Get request details error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get all requests for Admin Table
exports.getAllRequests = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ 
                error: 'Access denied. Admin only.' 
            });
        }
        
        const { status, documentType, dateFrom, dateTo } = req.query;
        
        let query = {};
        if (status && status !== 'all') query.status = status;
        if (documentType && documentType !== 'all') query.documentType = documentType;
        if (dateFrom || dateTo) {
            query.dateRequested = {};
            if (dateFrom) query.dateRequested.$gte = new Date(dateFrom);
            if (dateTo) query.dateRequested.$lte = new Date(dateTo);
        }
        
        const requests = await DocumentRequest.find(query)
            .populate('userId', 'firstName lastName email barangayName')
            .sort({ dateRequested: -1 });
        
        // Format for admin table
        const formattedRequests = requests.map(req => {
            const user = req.userId || {};
            return {
                id: req._id,
                requestId: req.requestId,
                fullName: req.fullName || `${user.firstName || ''} ${user.lastName || ''}`,
                documentType: req.documentType,
                dateRequested: req.dateRequested.toISOString().split('T')[0],
                verificationResult: req.verificationResult?.algorithmStatus || 'pending',
                confidence: req.verificationResult?.confidenceScore ? 
                    Math.round(req.verificationResult.confidenceScore * 100) + '%' : 'N/A',
                status: req.status,
                trackingCode: req.trackingCode,
                priority: req.priority,
                adminNotes: req.adminNotes || '',
                userId: req.userId?._id,
                userEmail: user.email || '',
                userBarangay: user.barangayName || 'Brgy Lajong',
                dateClaimed: req.dateClaimed ? req.dateClaimed.toISOString().split('T')[0] : null
            };
        });
        
        // Get status counts for stats
        const statusCounts = {
            all: await DocumentRequest.countDocuments(),
            pending: await DocumentRequest.countDocuments({ status: 'pending' }),
            verified: await DocumentRequest.countDocuments({ 
                $or: [
                    { status: 'verified' },
                    { 'verificationResult.algorithmStatus': 'verified' }
                ]
            }),
            'ready-to-claim': await DocumentRequest.countDocuments({ status: 'ready-to-claim' }),
            claimed: await DocumentRequest.countDocuments({ status: 'claimed' }),
            declined: await DocumentRequest.countDocuments({ status: 'declined' })
        };
        
        res.json({
            success: true,
            system: 'Barangay Lajong Admin Dashboard',
            stats: statusCounts,
            count: formattedRequests.length,
            requests: formattedRequests,
            statusOptions: ['pending', 'verified', 'ready-to-claim', 'claimed', 'declined']
        });
    } catch (error) {
        console.error('Get all requests error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Update request status (Admin only - dropdown)
exports.updateRequestStatus = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ 
                error: 'Access denied. Admin only.' 
            });
        }
        
        const { id } = req.params;
        const { status, adminNotes } = req.body;
        
        if (!status) {
            return res.status(400).json({ error: 'Status is required' });
        }
        
        // ✅ UPDATED STATUS OPTIONS INCLUDING 'claimed'
        const validStatuses = ['pending', 'verified', 'ready-to-claim', 'claimed', 'declined'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ 
                error: 'Invalid status',
                validStatuses
            });
        }
        
        const request = await DocumentRequest.findById(id);
        if (!request) {
            return res.status(404).json({ error: 'Document request not found' });
        }
        
        // ✅ VALIDATE STATUS TRANSITIONS
        const validTransitions = {
            'pending': ['verified', 'declined'],
            'verified': ['ready-to-claim', 'declined'],
            'ready-to-claim': ['claimed', 'declined'],
            'claimed': [], // Final state
            'declined': [] // Final state
        };
        
        if (validTransitions[request.status] && 
            !validTransitions[request.status].includes(status)) {
            return res.status(400).json({
                error: 'Invalid status transition',
                message: `Cannot change from "${request.status}" to "${status}"`,
                currentStatus: request.status,
                requestedStatus: status,
                allowedTransitions: validTransitions[request.status]
            });
        }
        
        // Update request
        const previousStatus = request.status;
        request.status = status;
        
        if (adminNotes) {
            request.adminNotes = adminNotes;
        }
        
        request.adminId = req.user.id;
        
        // Set dates based on status
        const now = new Date();
        if (status === 'ready-to-claim' && previousStatus !== 'ready-to-claim') {
            request.dateProcessed = now;
        }
        if (status === 'claimed') {
            request.dateClaimed = now;
            if (!request.dateProcessed) {
                request.dateProcessed = now;
            }
        }
        
        await request.save();
        
        // Get user info for response
        const user = await User.findById(request.userId).select('firstName lastName email');
        
        res.json({
            success: true,
            message: `Request status updated from "${previousStatus}" to "${status}"`,
            data: {
                requestId: request.requestId,
                fullName: request.fullName || `${user?.firstName || ''} ${user?.lastName || ''}`,
                documentType: request.documentType,
                previousStatus,
                newStatus: request.status,
                updatedBy: req.user.email,
                dateUpdated: now,
                dateProcessed: request.dateProcessed,
                dateClaimed: request.dateClaimed,
                adminNotes: request.adminNotes,
                userCanRequestAgain: status === 'claimed' || status === 'declined'
            }
        });
    } catch (error) {
        console.error('Update request status error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Generate and download PDF
exports.generatePDF = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role;
        
        let query = { _id: id };
        if (userRole !== 'admin') {
            query.userId = userId;
        }
        
        const request = await DocumentRequest.findOne(query)
            .populate('userId', 'firstName lastName email barangayName address contactNumber');
        
        if (!request) {
            return res.status(404).json({ 
                error: 'Document request not found'
            });
        }
        
        // Check if document is ready for PDF generation
        const allowedStatuses = ['verified', 'ready-to-claim', 'claimed', 'approved'];
        if (!allowedStatuses.includes(request.status) && userRole !== 'admin') {
            return res.status(400).json({
                error: 'Document not ready for download',
                message: 'Only verified, ready-to-claim, or claimed documents can be downloaded',
                currentStatus: request.status,
                allowedStatuses
            });
        }
        
        // Get user data
        const user = request.userId || await User.findById(request.userId);
        
        // Prepare data for PDF
        const pdfData = {
            requestId: request.requestId,
            trackingCode: request.trackingCode,
            documentType: request.documentType,
            fullName: request.fullName || `${user.firstName} ${user.lastName}`,
            permanentAddress: request.permanentAddress || user.address,
            employmentStatus: request.employmentStatus,
            purpose: request.purpose,
            cellphoneNumber: request.cellphoneNumber || user.contactNumber,
            verificationResult: request.verificationResult || {}
        };
        
        // Generate PDF
        const pdfBuffer = await generatePDFDocument(pdfData, user);
        
        // Set response headers
        const fileName = `BrgyLajong_${request.documentType.replace(/\s+/g, '_')}_${request.requestId}.pdf`;
        
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${fileName}"`,
            'Content-Length': pdfBuffer.length,
            'X-Document-ID': request.requestId,
            'X-Status': request.status,
            'X-Claimed-Date': request.dateClaimed ? request.dateClaimed.toISOString() : '',
            'X-Generated-Date': new Date().toISOString()
        });
        
        res.send(pdfBuffer);
        
    } catch (error) {
        console.error('Generate PDF error:', error);
        
        // Fallback to JSON response if PDF generation fails
        res.status(500).json({
            error: 'Failed to generate PDF',
            message: 'Document template generation failed',
            alternative: 'Please use the manual template at the barangay office'
        });
    }
};

// Preview PDF
exports.previewPDF = async (req, res) => {
    try {
        const { id } = req.params;
        const userRole = req.user.role;
        
        // Admin can preview any, residents only their own
        let query = { _id: id };
        if (userRole !== 'admin') {
            query.userId = req.user.id;
        }
        
        const request = await DocumentRequest.findOne(query)
            .populate('userId', 'firstName lastName email barangayName address');
        
        if (!request) {
            return res.status(404).json({ 
                error: 'Document request not found'
            });
        }
        
        // Get user data
        const user = request.userId || await User.findById(request.userId);
        
        // Prepare data for PDF
        const pdfData = {
            requestId: request.requestId,
            trackingCode: request.trackingCode,
            documentType: request.documentType,
            fullName: request.fullName || `${user.firstName} ${user.lastName}`,
            permanentAddress: request.permanentAddress || user.address,
            employmentStatus: request.employmentStatus,
            purpose: request.purpose,
            cellphoneNumber: request.cellphoneNumber || user.contactNumber,
            verificationResult: request.verificationResult || {}
        };
        
        // Generate PDF
        const pdfBuffer = await generatePDFDocument(pdfData, user);
        
        // Set response headers for browser preview
        const fileName = `BrgyLajong_${request.documentType.replace(/\s+/g, '_')}_${request.requestId}.pdf`;
        
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="${fileName}"`,
            'Content-Length': pdfBuffer.length
        });
        
        res.send(pdfBuffer);
        
    } catch (error) {
        console.error('Preview PDF error:', error);
        res.status(500).json({ 
            error: 'Failed to generate PDF preview',
            details: error.message
        });
    }
};

// Get request statistics
exports.getRequestStats = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ 
                error: 'Access denied. Admin only.' 
            });
        }
        
        // Get counts by status
        const statusCounts = {
            pending: await DocumentRequest.countDocuments({ status: 'pending' }),
            verified: await DocumentRequest.countDocuments({ 
                $or: [
                    { status: 'verified' },
                    { 'verificationResult.algorithmStatus': 'verified' }
                ]
            }),
            'ready-to-claim': await DocumentRequest.countDocuments({ status: 'ready-to-claim' }),
            claimed: await DocumentRequest.countDocuments({ status: 'claimed' }),
            declined: await DocumentRequest.countDocuments({ status: 'declined' }),
            total: await DocumentRequest.countDocuments()
        };
        
        // Get counts by document type
        const documentTypeCounts = {};
        const documentTypes = PHILIPPINE_DOCUMENT_TYPES.REQUEST_TYPES;
        
        for (const docType of documentTypes) {
            documentTypeCounts[docType] = await DocumentRequest.countDocuments({ 
                documentType: docType 
            });
        }
        
        // Get today's requests
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const todayCount = await DocumentRequest.countDocuments({
            dateRequested: {
                $gte: today,
                $lt: tomorrow
            }
        });
        
        // Get weekly requests
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weeklyCount = await DocumentRequest.countDocuments({
            dateRequested: {
                $gte: weekAgo
            }
        });
        
        // Get monthly claimed documents
        const monthAgo = new Date();
        monthAgo.setDate(monthAgo.getDate() - 30);
        const monthlyClaimed = await DocumentRequest.countDocuments({
            status: 'claimed',
            dateClaimed: {
                $gte: monthAgo
            }
        });
        
        res.json({
            success: true,
            system: 'Barangay Lajong Admin Statistics',
            stats: {
                statusCounts,
                documentTypeCounts,
                timeBased: {
                    today: todayCount,
                    last7Days: weeklyCount,
                    last30DaysClaimed: monthlyClaimed,
                    total: statusCounts.total
                }
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Get request stats error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get user's request history for specific document type
exports.getUserDocumentTypeHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        const { documentType } = req.params;
        
        if (!PHILIPPINE_DOCUMENT_TYPES.REQUEST_TYPES.includes(documentType)) {
            return res.status(400).json({
                error: 'Invalid document type',
                validTypes: PHILIPPINE_DOCUMENT_TYPES.REQUEST_TYPES
            });
        }
        
        const requests = await DocumentRequest.find({
            userId,
            documentType
        }).sort({ dateRequested: -1 });
        
        // Check if user can request this document type
        const activeRequests = requests.filter(req => 
            ['pending', 'under-review', 'verified', 'ready-to-claim', 'approved'].includes(req.status)
        );
        
        const canRequest = activeRequests.length === 0;
        
        // Check frequency for Certificate of Indigency
        let frequencyCheck = null;
        if (documentType === 'Certificate of Indigency' && requests.length > 0) {
            const lastRequest = requests[0];
            if (lastRequest.status === 'claimed' || lastRequest.status === 'declined') {
                const daysSince = Math.floor((new Date() - lastRequest.dateRequested) / (1000 * 60 * 60 * 24));
                frequencyCheck = {
                    canRequest: daysSince >= 30,
                    daysSince: daysSince,
                    daysRemaining: Math.max(0, 30 - daysSince),
                    lastRequestDate: lastRequest.dateRequested.toISOString().split('T')[0],
                    nextEligibleDate: new Date(lastRequest.dateRequested.getTime() + 30 * 24 * 60 * 60 * 1000)
                        .toISOString().split('T')[0]
                };
            }
        }
        
        res.json({
            success: true,
            documentType,
            canRequest: canRequest && (!frequencyCheck || frequencyCheck.canRequest),
            restrictions: {
                hasActiveRequest: activeRequests.length > 0,
                frequencyRestriction: frequencyCheck,
                message: activeRequests.length > 0 ? 
                    `You have ${activeRequests.length} active ${documentType} request(s)` :
                    frequencyCheck && !frequencyCheck.canRequest ?
                    `Certificate of Indigency: Can request again in ${frequencyCheck.daysRemaining} days` :
                    'You can request this document'
            },
            history: requests.map(req => ({
                requestId: req.requestId,
                status: req.status,
                dateRequested: req.dateRequested.toISOString().split('T')[0],
                dateClaimed: req.dateClaimed ? req.dateClaimed.toISOString().split('T')[0] : null,
                verificationResult: req.verificationResult?.algorithmStatus || 'pending',
                confidence: req.verificationResult?.confidenceScore ? 
                    Math.round(req.verificationResult.confidenceScore * 100) + '%' : 'N/A',
                purpose: req.purpose,
                isActive: ['pending', 'under-review', 'verified', 'ready-to-claim', 'approved'].includes(req.status)
            })),
            activeRequestCount: activeRequests.length,
            claimedCount: requests.filter(req => req.status === 'claimed').length,
            declinedCount: requests.filter(req => req.status === 'declined').length
        });
    } catch (error) {
        console.error('Get user document type history error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};