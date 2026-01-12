const PDFDocument = require('pdfkit');
const fs = require('fs').promises;
const path = require('path');
const moment = require('moment');

class TemplateService {
    constructor() {
        this.templatesPath = path.join(__dirname, '../../templates');
        this.generatedDocsPath = path.join(__dirname, '../../uploads/generated_docs');
        this.ensureTemplateFolders();
    }

    ensureTemplateFolders() {
        // This method doesn't need to be async for constructor
        const folders = [this.templatesPath, this.generatedDocsPath];
        
        folders.forEach(folder => {
            // We'll create folders on demand in async methods
            // This is just to ensure the paths are set
        });
    }

    // === MAIN METHOD: Generate PDF from Template File ===
    async generatePDFFromTemplate(templateName, data) {
        try {
            console.log(`📄 Generating PDF from template: ${templateName}`);
            
            // Check if template file exists
            const templatePath = path.join(this.templatesPath, `${templateName}.pdf`);
            
            try {
                await fs.access(templatePath);
                
                // Use existing PDF template
                return await this.fillExistingTemplate(templatePath, data);
                
            } catch (error) {
                console.log(`Template ${templateName}.pdf not found, generating dynamic PDF`);
                // Fallback to dynamic generation
                return await this.generateDocument(templateName, data);
            }
        } catch (error) {
            console.error('PDF generation error:', error);
            throw error;
        }
    }

    // === FILL EXISTING PDF TEMPLATE ===
    async fillExistingTemplate(templatePath, data) {
        return new Promise((resolve, reject) => {
            try {
                // Read the template PDF
                fs.readFile(templatePath).then(templateBuffer => {
                    // Create a new PDF to overlay data
                    const doc = new PDFDocument({ size: 'A4', margin: 50 });
                    const chunks = [];
                    
                    doc.on('data', chunk => chunks.push(chunk));
                    doc.on('end', () => {
                        const pdfBuffer = Buffer.concat(chunks);
                        resolve(pdfBuffer);
                    });
                    
                    // Embed the template as background
                    doc.image(templateBuffer, 0, 0, { width: 595.28, height: 841.89 });
                    
                    // Add dynamic data on top
                    this.addDynamicDataToPDF(doc, data);
                    
                    doc.end();
                }).catch(reject);
            } catch (error) {
                reject(error);
            }
        });
    }

    // === ADD DYNAMIC DATA TO PDF ===
    addDynamicDataToPDF(doc, data) {
        const { requestDetails, userInfo, documentType } = data;
        
        // Set font for overlay text
        doc.font('Helvetica-Bold').fontSize(10);
        
        // Add request details (position based on your template)
        const fields = {
            // Adjust these coordinates based on your template layout
            'FULL_NAME': { x: 100, y: 150, value: userInfo?.fullName || requestDetails?.fullName || '' },
            'ADDRESS': { x: 100, y: 170, value: userInfo?.address || requestDetails?.permanentAddress || '' },
            'PURPOSE': { x: 100, y: 190, value: requestDetails?.purpose || '' },
            'REQUEST_DATE': { x: 400, y: 150, value: requestDetails?.dateRequested ? moment(requestDetails.dateRequested).format('MMMM DD, YYYY') : moment().format('MMMM DD, YYYY') },
            'REQUEST_ID': { x: 400, y: 170, value: requestDetails?.requestId || '' },
            'CONTROL_NUMBER': { x: 400, y: 190, value: `CN-${Date.now()}` },
            'CURRENT_DATE': { x: 100, y: 350, value: moment().format('MMMM DD, YYYY') },
            'BARANGAY_NAME': { x: 300, y: 500, value: 'BARANGAY LAJONG' },
            'DOCUMENT_TYPE': { x: 50, y: 50, value: documentType || 'BARANGAY DOCUMENT' }
        };
        
        // Add each field to PDF
        Object.values(fields).forEach(field => {
            if (field.value) {
                doc.text(field.value, field.x, field.y);
            }
        });
        
        // Add signature line if needed
        if (data.includeSignature) {
            doc.moveTo(100, 450)
               .lineTo(250, 450)
               .stroke();
            
            doc.font('Helvetica').fontSize(9)
               .text('_________________________', 100, 460)
               .text('Barangay Captain', 100, 475)
               .text('Barangay Lajong', 100, 490);
        }
    }

    // === GET ALL AVAILABLE TEMPLATES ===
    async getAvailableTemplates() {
        try {
            await this.createFolderIfNotExists(this.templatesPath);
            const files = await fs.readdir(this.templatesPath);
            const pdfTemplates = files.filter(file => file.endsWith('.pdf'));
            
            const templates = [];
            
            for (const file of pdfTemplates) {
                const filePath = path.join(this.templatesPath, file);
                const stats = await fs.stat(filePath);
                
                templates.push({
                    filename: file,
                    displayName: this.formatTemplateName(file.replace('.pdf', '')),
                    path: filePath,
                    size: stats.size,
                    lastModified: stats.mtime
                });
            }
            
            return templates;
        } catch (error) {
            console.error('Error reading templates:', error);
            return [];
        }
    }

    // === CREATE FOLDER IF NOT EXISTS ===
    async createFolderIfNotExists(folderPath) {
        try {
            await fs.access(folderPath);
        } catch {
            await fs.mkdir(folderPath, { recursive: true });
        }
    }

    formatTemplateName(filename) {
        return filename
            .replace('.pdf', '')
            .replace(/_/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
    }

    // === SAVE GENERATED PDF ===
    async saveGeneratedPDF(pdfBuffer, requestId) {
        await this.createFolderIfNotExists(this.generatedDocsPath);
        
        const fileName = `document_${requestId}_${Date.now()}.pdf`;
        const filePath = path.join(this.generatedDocsPath, fileName);
        
        await fs.writeFile(filePath, pdfBuffer);
        
        return {
            fileName,
            filePath,
            downloadUrl: `/api/admin/documents/download/${fileName}`,
            size: pdfBuffer.length,
            generatedAt: new Date()
        };
    }

    // === PREVIEW TEMPLATE ===
    async previewTemplate(templateName) {
        try {
            const templatePath = path.join(this.templatesPath, `${templateName}.pdf`);
            await fs.access(templatePath);
            return await fs.readFile(templatePath);
        } catch (error) {
            throw new Error(`Template ${templateName} not found`);
        }
    }

    // === ORIGINAL DYNAMIC GENERATION (Keep for backup) ===
    generateDocument(templateType, data) {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({ size: 'A4', margin: 50 });
                const chunks = [];
                
                doc.on('data', chunk => chunks.push(chunk));
                doc.on('end', () => {
                    const pdfBuffer = Buffer.concat(chunks);
                    resolve(pdfBuffer);
                });
                
                // Add header
                this.addHeader(doc, templateType);
                
                // Add content based on template type
                switch (templateType) {
                    case 'Barangay Clearance':
                        this.generateBarangayClearance(doc, data);
                        break;
                    case 'Certificate of Residency':
                        this.generateCertificateOfResidency(doc, data);
                        break;
                    case 'Certificate of Indigency':
                        this.generateCertificateOfIndigency(doc, data);
                        break;
                    case 'Good Moral Certificate':
                        this.generateGoodMoralCertificate(doc, data);
                        break;
                    case 'First Time Job Seeker Certificate':
                        this.generateFirstTimeJobSeeker(doc, data);
                        break;
                    case 'Business Permit':
                        this.generateBusinessPermit(doc, data);
                        break;
                    default:
                        this.generateGenericCertificate(doc, data, templateType);
                }
                
                // Add footer
                this.addFooter(doc, data);
                
                doc.end();
            } catch (error) {
                reject(error);
            }
        });
    }

    // === NEW: First Time Job Seeker Certificate ===
    generateFirstTimeJobSeeker(doc, data) {
        const today = moment().format('MMMM DD, YYYY');
        
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .text('CERTIFICATION - FIRST TIME JOB SEEKER', { align: 'center' });
        
        doc.moveDown(1);
        
        doc.fontSize(12)
           .font('Helvetica')
           .text('TO WHOM IT MAY CONCERN:', { align: 'left' });
        
        doc.moveDown(1);
        
        doc.text(`This is to certify that ${data.fullName}, ${data.age || '[Age]'} years old, single, Filipino, and a resident of ${data.permanentAddress}, is a First Time Job Seeker as defined under Republic Act No. 11261 or the "First Time Job Seekers Assistance Act."`, { align: 'justify' });
        
        doc.moveDown(1);
        
        doc.text(`Based on the records of this Barangay, ${data.fullName} has never been employed before, either locally or abroad, and is actively seeking employment.`, { align: 'justify' });
        
        doc.moveDown(1);
        
        doc.text(`This certification is issued to avail of the benefits under RA 11261, particularly the exemption from payment of fees for government documents and services required for employment.`, { align: 'justify' });
        
        doc.moveDown(1);
        
        doc.text(`Issued this ${today} at Barangay ${data.barangayName || 'Lajong'}.`, { align: 'justify' });
        
        doc.moveDown(3);
        
        doc.text('_________________________', { align: 'right' });
        doc.text('Barangay Captain', { align: 'right' });
        doc.text(`Barangay ${data.barangayName || 'Lajong'}`, { align: 'right' });
    }

    // === NEW: Business Permit ===
    generateBusinessPermit(doc, data) {
        const today = moment().format('MMMM DD, YYYY');
        
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .text('BARANGAY BUSINESS PERMIT', { align: 'center' });
        
        doc.moveDown(1);
        
        doc.fontSize(12)
           .font('Helvetica')
           .text('This is to certify that:', { align: 'left' });
        
        doc.moveDown(1);
        
        doc.text(`Business Name: ${data.businessName || '[Business Name]'}`);
        doc.text(`Owner: ${data.fullName}`);
        doc.text(`Business Address: ${data.businessAddress || data.permanentAddress}`);
        doc.text(`Type of Business: ${data.businessType || '[Type of Business]'}`);
        
        doc.moveDown(1);
        
        doc.text(`has been granted a Barangay Business Permit to operate within Barangay ${data.barangayName || 'Lajong'} for the period of ${data.validityPeriod || 'January 1 to December 31 of the current year'}.`, { align: 'justify' });
        
        doc.moveDown(1);
        
        doc.text(`This permit is subject to compliance with all Barangay ordinances and regulations.`, { align: 'justify' });
        
        doc.moveDown(1);
        
        doc.text(`Issued this ${today} at Barangay ${data.barangayName || 'Lajong'}.`, { align: 'justify' });
        
        doc.moveDown(3);
        
        doc.text('_________________________', { align: 'right' });
        doc.text('Barangay Captain', { align: 'right' });
        doc.text(`Barangay ${data.barangayName || 'Lajong'}`, { align: 'right' });
    }

    // === KEEP ALL YOUR EXISTING METHODS ===
    addHeader(doc, documentType) {
        // Logo (you would add your barangay logo here)
        doc.fontSize(20)
           .font('Helvetica-Bold')
           .text('BARANGAY LAJONG DOCUMENT', { align: 'center' });
        
        doc.moveDown(0.5);
        doc.fontSize(16)
           .font('Helvetica')
           .text(documentType, { align: 'center' });
        
        doc.moveDown(1);
        doc.fontSize(12)
           .text(`Control No: ${Date.now()}${Math.floor(Math.random() * 1000)}`, { align: 'right' });
        
        doc.moveTo(50, doc.y)
           .lineTo(550, doc.y)
           .stroke();
        
        doc.moveDown(1);
    }

    generateBarangayClearance(doc, data) {
        const today = moment().format('MMMM DD, YYYY');
        
        doc.fontSize(12)
           .font('Helvetica')
           .text('TO WHOM IT MAY CONCERN:', { align: 'left' });
        
        doc.moveDown(1);
        
        doc.font('Helvetica')
           .text(`This is to certify that ${data.fullName}, of legal age, ${data.civilStatus || 'single'}, Filipino, is a bona fide resident of ${data.permanentAddress}.`, { align: 'justify' });
        
        doc.moveDown(1);
        
        doc.text(`Further certified that as per records of this Barangay, ${data.fullName} has no derogatory record filed in this office and is known to be of good moral character and a law-abiding citizen.`, { align: 'justify' });
        
        doc.moveDown(1);
        
        doc.text(`This certification is issued upon the request of ${data.fullName} for ${data.purpose || 'employment purposes'}.`, { align: 'justify' });
        
        doc.moveDown(2);
        
        doc.text(`Issued this ${today} at Barangay ${data.barangayName || 'Lajong'}.`, { align: 'justify' });
        
        doc.moveDown(3);
        
        // Signature section
        doc.text('_________________________', { align: 'right' });
        doc.text('Barangay Captain', { align: 'right' });
        doc.text(`Barangay ${data.barangayName || 'Lajong'}`, { align: 'right' });
    }

    generateCertificateOfResidency(doc, data) {
        const today = moment().format('MMMM DD, YYYY');
        
        doc.fontSize(12)
           .font('Helvetica')
           .text('CERTIFICATION OF RESIDENCY', { align: 'center', underline: true });
        
        doc.moveDown(1);
        
        doc.text('TO WHOM IT MAY CONCERN:', { align: 'left' });
        
        doc.moveDown(1);
        
        doc.text(`This is to certify that based on the records available in this office, ${data.fullName}, ${data.age || '[Age]'} years old, is a bona fide resident of ${data.permanentAddress} since ${data.residencyStart || '[Year]'}.`, { align: 'justify' });
        
        doc.moveDown(1);
        
        doc.text(`This certification is issued for ${data.purpose || 'whatever legal purpose it may serve'}.`, { align: 'justify' });
        
        doc.moveDown(1);
        
        doc.text(`Given this ${today} at Barangay ${data.barangayName || 'Lajong'}.`, { align: 'justify' });
        
        doc.moveDown(3);
        
        doc.text('_________________________', { align: 'right' });
        doc.text('Barangay Secretary', { align: 'right' });
        doc.text(`Barangay ${data.barangayName || 'Lajong'}`, { align: 'right' });
    }

    generateCertificateOfIndigency(doc, data) {
        const today = moment().format('MMMM DD, YYYY');
        
        doc.fontSize(12)
           .font('Helvetica')
           .text('CERTIFICATE OF INDIGENCY', { align: 'center', underline: true });
        
        doc.moveDown(1);
        
        doc.text('TO WHOM IT MAY CONCERN:', { align: 'left' });
        
        doc.moveDown(1);
        
        doc.text(`This is to certify that ${data.fullName}, ${data.age || '[Age]'} years old, is a bona fide resident of ${data.permanentAddress}.`, { align: 'justify' });
        
        doc.moveDown(1);
        
        doc.text(`Based on the assessment conducted by this office, ${data.fullName} belongs to an indigent family with an estimated monthly income of PHP ${data.monthlyIncome || '0.00'}.`, { align: 'justify' });
        
        doc.moveDown(1);
        
        doc.text(`This certification is issued to avail of ${data.purpose || 'government services and assistance'}.`, { align: 'justify' });
        
        doc.moveDown(1);
        
        doc.text(`Issued this ${today} at Barangay ${data.barangayName || 'Lajong'}.`, { align: 'justify' });
        
        doc.moveDown(3);
        
        doc.text('_________________________', { align: 'right' });
        doc.text('Barangay Social Welfare Officer', { align: 'right' });
        doc.text(`Barangay ${data.barangayName || 'Lajong'}`, { align: 'right' });
    }

    generateGoodMoralCertificate(doc, data) {
        const today = moment().format('MMMM DD, YYYY');
        
        doc.fontSize(12)
           .font('Helvetica')
           .text('CERTIFICATE OF GOOD MORAL CHARACTER', { align: 'center', underline: true });
        
        doc.moveDown(1);
        
        doc.text('TO WHOM IT MAY CONCERN:', { align: 'left' });
        
        doc.moveDown(1);
        
        doc.text(`This is to certify that ${data.fullName}, ${data.age || '[Age]'} years old, is a resident of ${data.permanentAddress}.`, { align: 'justify' });
        
        doc.moveDown(1);
        
        doc.text(`Based on the records of this Barangay and from the information gathered, ${data.fullName} has not been involved in any illegal activities and is known to possess good moral character in this community.`, { align: 'justify' });
        
        doc.moveDown(1);
        
        doc.text(`This certification is issued for ${data.purpose || 'academic/employment purposes'} upon the request of the above-named person.`, { align: 'justify' });
        
        doc.moveDown(1);
        
        doc.text(`Issued this ${today} at Barangay ${data.barangayName || 'Lajong'}.`, { align: 'justify' });
        
        doc.moveDown(3);
        
        doc.text('_________________________', { align: 'right' });
        doc.text('Barangay Captain', { align: 'right' });
        doc.text(`Barangay ${data.barangayName || 'Lajong'}`, { align: 'right' });
    }

    generateGenericCertificate(doc, data, documentType) {
        const today = moment().format('MMMM DD, YYYY');
        
        doc.fontSize(12)
           .font('Helvetica')
           .text(documentType.toUpperCase(), { align: 'center', underline: true });
        
        doc.moveDown(1);
        
        doc.text('TO WHOM IT MAY CONCERN:', { align: 'left' });
        
        doc.moveDown(1);
        
        doc.text(`This is to certify that ${data.fullName} is a resident of ${data.permanentAddress}.`, { align: 'justify' });
        
        doc.moveDown(1);
        
        doc.text(`This certification is issued for ${data.purpose || 'whatever legal purpose it may serve'}.`, { align: 'justify' });
        
        doc.moveDown(1);
        
        doc.text(`Issued this ${today} at Barangay ${data.barangayName || 'Lajong'}.`, { align: 'justify' });
        
        doc.moveDown(3);
        
        doc.text('_________________________', { align: 'right' });
        doc.text('Barangay Official', { align: 'right' });
        doc.text(`Barangay ${data.barangayName || 'Lajong'}`, { align: 'right' });
    }

    addFooter(doc, data) {
        const pageHeight = doc.page.height;
        const footerY = pageHeight - 100;
        
        doc.y = footerY;
        
        doc.moveTo(50, doc.y)
           .lineTo(550, doc.y)
           .stroke();
        
        doc.moveDown(0.5);
        
        doc.fontSize(8)
           .font('Helvetica-Oblique')
           .text('Note: This document is computer-generated and requires the official seal and signature of the Barangay Captain.', { align: 'center' });
        
        doc.moveDown(0.5);
        
        doc.text(`Request ID: ${data.requestId || 'N/A'} | Issued on: ${moment().format('YYYY-MM-DD HH:mm:ss')}`, { align: 'center' });
    }
}

module.exports = new TemplateService();