# Barangay Document Request System - Backend

A complete backend system for barangay document requests with automated ID verification using CNN and OCR.

## Features

- **User Authentication**: Register, login, password reset
- **Document Requests**: Submit requests for various barangay documents
- **Automated Verification**: CNN for ID classification + OCR for text extraction
- **Admin Dashboard**: Manage requests, view statistics
- **Real-time Tracking**: Track request status
- **Document Generation**: Auto-generate PDF documents
- **File Upload**: Secure file upload with validation

## Tech Stack

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM for MongoDB
- **TensorFlow.js** - CNN for ID classification
- **Tesseract.js** - OCR for text extraction
- **JWT** - Authentication
- **Multer** - File uploads
- **PDFKit** - PDF generation

## Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/document-request-system.git
cd document-request-system/backend