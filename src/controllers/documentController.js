const DocumentRequest = require('../models/DocumentRequest');
const DocumentType = require('../models/DocumentType');
const verificationService = require('../services/verificationService');
const templateService = require('../services/templateService');
const fs = require('fs').promises;
const path = require('path');

// Philippine document types
const PHILIPPINE_DOCUMENT_TYPES = {
    PRIMARY: [
        'Philippine Passport',
        'UMID (Unified Multi-Purpose ID)',
        'Drivers License (LTO)',
        'Postal ID',
        'National ID (PhilSys)',
        'SSS ID (Social Security System)',
        'GSIS ID (Government Service Insurance System)',
        'Voters ID',
        'PhilHealth ID'
    ],
    SECONDARY: [
        'Municipal ID',
        'TIN ID (Tax Identification Number)',
        'Barangay ID',
        'Student ID'
    ]
};

exports.getDocumentTypes = async (req, res) => {
    try {
        res.json({
            success: true,
            system: 'Philippine Document Request System',
            categories: {
                primary: {
                    count: PHILIPPINE_DOCUMENT_TYPES.PRIMARY.length,
                    documents: PHILIPPINE_DOCUMENT_TYPES.PRIMARY
                },
                secondary: {
                    count: PHILIPPINE_DOCUMENT_TYPES.SECONDARY.length,
                    documents: PHILIPPINE_DOCUMENT_TYPES.SECONDARY
                }
            },
            notes: [
                'Primary IDs are accepted for all document requests',
                'Secondary IDs may require additional verification',
                'All documents must be valid Philippine-issued IDs',
                'Upload clear images of the FRONT side only'
            ]
        });
    } catch (error) {
        console.error('Get Philippine document types error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

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
            idType
        } = req.body;

        // Validate Philippine document type
        const allPhilippineTypes = [...PHILIPPINE_DOCUMENT_TYPES.PRIMARY, ...PHILIPPINE_DOCUMENT_TYPES.SECONDARY];
        if (!allPhilippineTypes.includes(documentType)) {
            return res.status(400).json({
                error: 'Invalid Philippine document type',
                validTypes: allPhilippineTypes
            });
        }

        // Validate Philippine ID type
        if (!allPhilippineTypes.includes(idType)) {
            return res.status(400).json({
                error: 'Invalid Philippine ID type',
                validTypes: allPhilippineTypes
            });
        }

        // Validate request data
        const validation = await verificationService.validatePhilippineRequestData({
            documentType,
            fullName,
            permanentAddress,
            purpose,
            cellphoneNumber
        });

        if (!validation.isValid) {
            return res.status(400).json({
                error: 'Philippine document validation failed',
                details: validation.errors
            });
        }

        // Check if files were uploaded
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ 
                error: 'Please upload at least one Philippine ID attachment' 
            });
        }

        // Check if uploaded file is a Philippine ID (optional)
        const fileValidation = await verificationService.validatePhilippineIDFile(req.files[0]);
        if (!fileValidation.isValid) {
            return res.status(400).json({
                error: 'Invalid Philippine ID file',
                details: fileValidation.errors
            });
        }

        // Prepare attachments data
        const attachments = req.files.map(file => ({
            filename: file.filename,
            path: file.path,
            verifiedType: idType,
            category: PHILIPPINE_DOCUMENT_TYPES.PRIMARY.includes(idType) ? 'Primary' : 'Secondary'
        }));

        // Create Philippine document request
        const documentRequest = new DocumentRequest({
            userId,
            documentType,
            fullName,
            permanentAddress,
            purpose,
            employmentStatus,
            cellphoneNumber,
            attachments,
            status: 'pending',
            barangay: req.user.barangay || 'Brgy. Lajong'
        });

        // Run automated Philippine document verification
        const verificationResult = await verificationService.verifyPhilippineDocuments(
            attachments,
            attachments.map(a => a.verifiedType)
        );

        // Update request with verification results
        documentRequest.verificationResult = {
            isVerified: verificationResult.overallVerified,
            confidenceScore: verificationResult.averageConfidence,
            detectedIdType: verificationResult.individualResults[0]?.detectedIdType || 'Unknown',
            extractedText: verificationResult.individualResults[0]?.extractedText || {},
            mismatch: verificationResult.hasMismatch,
            mismatchDetails: verificationResult.mismatchDetails.join(', '),
            category: verificationResult.category,
            isPrimaryID: PHILIPPINE_DOCUMENT_TYPES.PRIMARY.includes(verificationResult.detectedIdType)
        };

        // Update status based on Philippine document verification
        if (verificationResult.hasMismatch) {
            documentRequest.status = 'under-review';
            documentRequest.reviewNotes = 'Philippine ID type mismatch detected';
        } else if (verificationResult.overallVerified) {
            documentRequest.status = 'verified';
        } else {
            documentRequest.status = 'needs-additional-ids';
            documentRequest.reviewNotes = 'Additional Philippine ID verification needed';
        }

        await documentRequest.save();

        // Prepare Philippine document response
        const response = {
            success: true,
            system: 'Philippine Document Request System',
            requestId: documentRequest.requestId,
            trackingCode: documentRequest.trackingCode,
            status: documentRequest.status,
            verificationResult: documentRequest.verificationResult,
            message: 'Philippine document request submitted successfully'
        };

        // Add warning for Philippine document mismatch
        if (verificationResult.hasMismatch) {
            response.warning = 'Philippine ID type mismatch detected. Barangay verification required.';
            response.mismatchDetails = verificationResult.mismatchDetails;
            response.instructions = 'Please visit Brgy. Lajong office for manual verification';
        }

        // Add note for secondary IDs
        if (documentRequest.verificationResult.category === 'Secondary') {
            response.note = 'Secondary Philippine ID submitted. Primary ID recommended for faster processing.';
        }

        res.status(201).json(response);

    } catch (error) {
        console.error('Create Philippine document request error:', error);
        
        // Clean up uploaded files if error occurs
        if (req.files) {
            req.files.forEach(async file => {
                try {
                    await fs.unlink(file.path);
                } catch (unlinkError) {
                    console.error('Error cleaning up Philippine ID file:', unlinkError);
                }
            });
        }
        
        res.status(500).json({ 
            error: 'Server error creating Philippine document request',
            system: 'Brgy. Lajong Document System'
        });
    }
};

exports.getUserRequests = async (req, res) => {
    try {
        const userId = req.user.id;
        const { status, documentType, category } = req.query;
        
        let query = { userId };
        
        // Apply Philippine document filters
        if (status) query.status = status;
        if (documentType) query.documentType = documentType;
        if (category) {
            if (category === 'primary') {
                query.documentType = { $in: PHILIPPINE_DOCUMENT_TYPES.PRIMARY };
            } else if (category === 'secondary') {
                query.documentType = { $in: PHILIPPINE_DOCUMENT_TYPES.SECONDARY };
            }
        }
        
        const requests = await DocumentRequest.find(query)
            .sort({ dateRequested: -1 })
            .select('-attachments.path -verificationResult.extractedText.rawText');
        
        res.json({
            success: true,
            system: 'Philippine Document Request System',
            count: requests.length,
            data: requests.map(req => ({
                ...req.toObject(),
                isPrimary: PHILIPPINE_DOCUMENT_TYPES.PRIMARY.includes(req.documentType)
            }))
        });
    } catch (error) {
        console.error('Get Philippine document requests error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getRequestDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        
        const request = await DocumentRequest.findOne({
            _id: id,
            userId
        }).populate('userId', 'firstName lastName email barangay');
        
        if (!request) {
            return res.status(404).json({ 
                error: 'Philippine document request not found' 
            });
        }
        
        // Prepare safe response for Philippine documents
        const safeRequest = request.toObject();
        safeRequest.attachments = safeRequest.attachments.map(att => ({
            filename: att.filename,
            documentType: att.documentType,
            verifiedType: att.verifiedType,
            category: att.category,
            uploadDate: att.uploadDate
        }));
        
        // Add Philippine document info
        safeRequest.isPrimaryID = PHILIPPINE_DOCUMENT_TYPES.PRIMARY.includes(request.documentType);
        safeRequest.system = 'Brgy. Lajong Philippine Document System';
        
        res.json({
            success: true,
            system: 'Philippine Document Request System',
            data: safeRequest
        });
    } catch (error) {
        console.error('Get Philippine document details error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.updateRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const updateData = req.body;
        
        // Find Philippine document request
        const request = await DocumentRequest.findOne({
            _id: id,
            userId,
            status: { $in: ['pending', 'under-review', 'failed', 'needs-additional-ids'] }
        });
        
        if (!request) {
            return res.status(404).json({ 
                error: 'Philippine document request not found or cannot be updated' 
            });
        }
        
        // Only allow updates to certain fields
        const allowedUpdates = ['purpose', 'employmentStatus', 'cellphoneNumber'];
        allowedUpdates.forEach(field => {
            if (updateData[field] !== undefined) {
                request[field] = updateData[field];
            }
        });
        
        // If Philippine ID files are being updated
        if (req.files && req.files.length > 0) {
            // Validate new Philippine ID files
            const fileValidation = await verificationService.validatePhilippineIDFile(req.files[0]);
            if (!fileValidation.isValid) {
                return res.status(400).json({
                    error: 'Invalid Philippine ID file',
                    details: fileValidation.errors
                });
            }
            
            // Delete old Philippine ID files
            for (const attachment of request.attachments) {
                try {
                    await fs.unlink(attachment.path);
                } catch (error) {
                    console.error('Error deleting old Philippine ID file:', error);
                }
            }
            
            // Add new Philippine attachments
            request.attachments = req.files.map(file => ({
                filename: file.filename,
                path: file.path,
                verifiedType: updateData.idType || request.attachments[0]?.verifiedType,
                category: PHILIPPINE_DOCUMENT_TYPES.PRIMARY.includes(updateData.idType) ? 'Primary' : 'Secondary'
            }));
            
            // Re-run Philippine document verification
            const verificationResult = await verificationService.verifyPhilippineDocuments(
                request.attachments,
                request.attachments.map(a => a.verifiedType)
            );
            
            request.verificationResult = {
                isVerified: verificationResult.overallVerified,
                confidenceScore: verificationResult.averageConfidence,
                detectedIdType: verificationResult.individualResults[0]?.detectedIdType || 'Unknown',
                extractedText: verificationResult.individualResults[0]?.extractedText || {},
                mismatch: verificationResult.hasMismatch,
                mismatchDetails: verificationResult.mismatchDetails.join(', '),
                category: verificationResult.category
            };
            
            // Update status based on Philippine verification
            if (verificationResult.hasMismatch) {
                request.status = 'under-review';
                request.reviewNotes = 'Updated: Philippine ID type mismatch detected';
            } else if (verificationResult.overallVerified) {
                request.status = 'verified';
                request.reviewNotes = 'Updated: Philippine ID verification passed';
            } else {
                request.status = 'needs-additional-ids';
                request.reviewNotes = 'Updated: Additional Philippine ID needed';
            }
        }
        
        await request.save();
        
        res.json({
            success: true,
            system: 'Philippine Document Request System',
            message: 'Philippine document request updated successfully',
            data: {
                ...request.toObject(),
                isPrimary: PHILIPPINE_DOCUMENT_TYPES.PRIMARY.includes(request.documentType)
            }
        });
    } catch (error) {
        console.error('Update Philippine document request error:', error);
        res.status(500).json({ 
            error: 'Server error updating Philippine document request',
            system: 'Brgy. Lajong Document System'
        });
    }
};

exports.uploadAttachments = async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ 
                error: 'No Philippine ID files uploaded' 
            });
        }
        
        // Validate Philippine ID files
        for (const file of req.files) {
            const validation = await verificationService.validatePhilippineIDFile(file);
            if (!validation.isValid) {
                return res.status(400).json({
                    error: `Invalid Philippine ID file: ${file.originalname}`,
                    details: validation.errors
                });
            }
        }
        
        const attachments = req.files.map(file => ({
            filename: file.filename,
            path: file.path,
            size: file.size,
            mimetype: file.mimetype,
            isPhilippineID: true
        }));
        
        res.json({
            success: true,
            system: 'Philippine Document Upload',
            message: 'Philippine ID files uploaded successfully',
            attachments
        });
    } catch (error) {
        console.error('Upload Philippine ID attachments error:', error);
        res.status(500).json({ 
            error: 'Server error uploading Philippine ID files',
            system: 'Brgy. Lajong Document System'
        });
    }
};

exports.downloadDocument = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        
        const request = await DocumentRequest.findOne({
            _id: id,
            userId,
            status: 'ready-to-claim'
        });
        
        if (!request) {
            return res.status(404).json({ 
                error: 'Philippine document not found or not ready for download',
                instructions: 'Document must be in "ready-to-claim" status'
            });
        }
        
        // Generate Philippine-style document
        const pdfBuffer = await templateService.generatePhilippineDocument(
            request.documentType,
            {
                ...request.toObject(),
                requestId: request.requestId,
                barangayName: req.user.barangayName || 'Barangay Lajong',
                municipality: req.user.municipality || 'City',
                province: req.user.province || 'Province',
                philippineDate: new Date().toLocaleDateString('en-PH', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                })
            }
        );
        
        // Set headers for Philippine document
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="BrgyLajong_${request.documentType.replace(/\s+/g, '_')}_${request.requestId}.pdf"`,
            'Content-Length': pdfBuffer.length,
            'X-Document-System': 'Philippine Document Request System',
            'X-Barangay': 'Lajong'
        });
        
        // Send Philippine document
        res.send(pdfBuffer);
        
    } catch (error) {
        console.error('Download Philippine document error:', error);
        res.status(500).json({ 
            error: 'Server error generating Philippine document',
            system: 'Brgy. Lajong Document System'
        });
    }
};