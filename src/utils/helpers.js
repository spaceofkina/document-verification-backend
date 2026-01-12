const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;

class Helpers {
    // Generate random string
    static generateRandomString(length = 10) {
        return crypto.randomBytes(Math.ceil(length / 2))
            .toString('hex')
            .slice(0, length);
    }

    // Generate tracking code
    static generateTrackingCode() {
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        return `TRK${timestamp}${random}`;
    }

    // Format file size
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Sanitize filename
    static sanitizeFilename(filename) {
        return filename
            .replace(/[^a-zA-Z0-9.\-_]/g, '_')
            .replace(/_+/g, '_')
            .substring(0, 255);
    }

    // Validate email
    static isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Validate phone number (Philippines format)
    static isValidPhilippinePhone(phone) {
        const phoneRegex = /^(09|\+639)\d{9}$/;
        return phoneRegex.test(phone.replace(/\s/g, ''));
    }

    // Create directory if not exists
    static async ensureDirectoryExists(dirPath) {
        try {
            await fs.access(dirPath);
        } catch {
            await fs.mkdir(dirPath, { recursive: true });
        }
    }

    // Delete file safely
    static async safeDeleteFile(filePath) {
        try {
            await fs.unlink(filePath);
            return true;
        } catch (error) {
            console.error(`Error deleting file ${filePath}:`, error);
            return false;
        }
    }

    // Get file extension
    static getFileExtension(filename) {
        return path.extname(filename).toLowerCase();
    }

    // Check if file is image
    static isImageFile(filename) {
        const ext = this.getFileExtension(filename);
        return ['.jpg', '.jpeg', '.png', '.gif', '.bmp'].includes(ext);
    }

    // Check if file is PDF
    static isPDFFile(filename) {
        const ext = this.getFileExtension(filename);
        return ext === '.pdf';
    }

    // Generate date range for queries
    static generateDateRange(days = 30) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        
        return {
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0]
        };
    }

    // Calculate processing time
    static calculateProcessingTime(startDate, endDate = new Date()) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    }

    // Format date for display
    static formatDate(date, format = 'YYYY-MM-DD HH:mm:ss') {
        const d = new Date(date);
        const pad = (num) => num.toString().padStart(2, '0');
        
        const replacements = {
            'YYYY': d.getFullYear(),
            'MM': pad(d.getMonth() + 1),
            'DD': pad(d.getDate()),
            'HH': pad(d.getHours()),
            'mm': pad(d.getMinutes()),
            'ss': pad(d.getSeconds())
        };
        
        return format.replace(/YYYY|MM|DD|HH|mm|ss/g, match => replacements[match]);
    }

    // Paginate array
    static paginateArray(array, page = 1, limit = 10) {
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        
        return {
            data: array.slice(startIndex, endIndex),
            page: parseInt(page),
            limit: parseInt(limit),
            total: array.length,
            pages: Math.ceil(array.length / limit)
        };
    }

    // Deep clone object (simple version)
    static deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    // Merge objects deeply
    static deepMerge(target, source) {
        const output = Object.assign({}, target);
        if (this.isObject(target) && this.isObject(source)) {
            Object.keys(source).forEach(key => {
                if (this.isObject(source[key])) {
                    if (!(key in target)) {
                        Object.assign(output, { [key]: source[key] });
                    } else {
                        output[key] = this.deepMerge(target[key], source[key]);
                    }
                } else {
                    Object.assign(output, { [key]: source[key] });
                }
            });
        }
        return output;
    }

    // Check if value is object
    static isObject(item) {
        return item && typeof item === 'object' && !Array.isArray(item);
    }

    // Remove null/undefined values from object
    static cleanObject(obj) {
        const cleaned = {};
        Object.keys(obj).forEach(key => {
            if (obj[key] !== null && obj[key] !== undefined) {
                cleaned[key] = obj[key];
            }
        });
        return cleaned;
    }

    // Generate progress percentage
    static calculateProgress(current, total) {
        if (total === 0) return 0;
        return Math.round((current / total) * 100);
    }

    // Create success response
    static successResponse(data, message = 'Success') {
        return {
            success: true,
            message,
            data
        };
    }

    // Create error response
    static errorResponse(message = 'Error', errors = null) {
        return {
            success: false,
            message,
            errors
        };
    }
}

module.exports = Helpers;