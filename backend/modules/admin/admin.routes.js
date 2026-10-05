const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const controller = require('./admin.controller');
const { authenticate } = require('../../middleware/auth');
const { authorize } = require('../../middleware/rbac');
const { handleValidation } = require('../../middleware/validate');
const { csrfProtection } = require('../../middleware/csrf');

// All admin routes require Admin role
router.get('/users',       authenticate, authorize('Admin'), controller.listUsers);
router.get('/dashboard',   authenticate, authorize('Admin'), controller.getDashboard);

router.post('/users',
  csrfProtection,
  authenticate,
  authorize('Admin'),
  [
    body('fullName').trim().notEmpty().withMessage('Full name is required.'),
    body('email').isEmail().normalizeEmail().withMessage('A valid email is required.'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
    body('role').isIn(['Student', 'Teacher', 'Admin']).withMessage('Role must be Student, Teacher, or Admin.'),
  ],
  handleValidation,
  controller.createUser
);

router.patch('/users/:id',
  csrfProtection,
  authenticate,
  authorize('Admin'),
  controller.updateUser
);

router.delete('/users/:id',
  csrfProtection,
  authenticate,
  authorize('Admin'),
  controller.deleteUser
);

module.exports = router;
