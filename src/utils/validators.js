const { body, param, query } = require('express-validator');

const authValidators = {
    register: [
        body('email').isEmail().normalizeEmail(),
        body('password').isLength({ min: 6 }),
        body('firstName').notEmpty().trim(),
        body('lastName').notEmpty().trim()
    ],
    
    login: [
        body('email').isEmail().normalizeEmail(),
        body('password').notEmpty()
    ],
    
    forgotPassword: [
        body('email').isEmail().normalizeEmail()
    ],
    
    resetPassword: [
        param('token').notEmpty(),
        body('password').isLength({ min: 6 })
    ]
};

const documentValidators = {
    createRequest: [
        body('documentType').isIn([
            'Certificate of Residency',
            'Barangay Clearance',
            'First-Time Job Seeker Certificate',
            'Certificate of Indigency',
            'Good Moral Certificate',
            'Barangay Permit'
        ]),
        body('fullName').notEmpty().trim(),
        body('permanentAddress').notEmpty().trim(),
        body('purpose').notEmpty().trim(),
        body('idType').optional().isIn(['National ID', 'Driver License', 'Passport', 'Birth Certificate', 'Others'])
    ],
    
    updateRequest: [
        param('id').isMongoId(),
        body('purpose').optional().notEmpty().trim(),
        body('employmentStatus').optional().isIn(['Employed', 'Unemployed', 'Self-employed', 'Student']),
        body('cellphoneNumber').optional().isMobilePhone()
    ]
};

const userValidators = {
    updateProfile: [
        body('firstName').optional().notEmpty().trim(),
        body('lastName').optional().notEmpty().trim(),
        body('contactNumber').optional().isMobilePhone(),
        body('address').optional().trim()
    ],
    
    changePassword: [
        body('currentPassword').notEmpty(),
        body('newPassword').isLength({ min: 6 })
    ]
};

const adminValidators = {
    updateStatus: [
        param('id').isMongoId(),
        body('status').isIn(['verified', 'failed', 'approved', 'declined', 'ready-to-claim']),
        body('adminNotes').optional().trim()
    ]
};

module.exports = {
    authValidators,
    documentValidators,
    userValidators,
    adminValidators
};