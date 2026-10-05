const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const controller = require('./auth.controller');
const { authenticate } = require('../../middleware/auth');
const { handleValidation } = require('../../middleware/validate');
const { csrfProtection } = require('../../middleware/csrf');

// GET /api/auth/csrf-token — fetch CSRF token before any mutating request
router.get('/csrf-token', csrfProtection, controller.getCsrfToken);

// POST /api/auth/register
router.post('/register',
  csrfProtection,
  [
    body('fullName').trim().notEmpty().withMessage('Full name is required.'),
    body('email').isEmail().normalizeEmail().withMessage('A valid email address is required.'),
    body('password')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters.')
      .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter.')
      .matches(/[0-9]/).withMessage('Password must contain at least one number.'),
  ],
  handleValidation,
  controller.register
);

// POST /api/auth/login
router.post('/login',
  csrfProtection,
  [
    body('email').isEmail().normalizeEmail().withMessage('A valid email address is required.'),
    body('password').notEmpty().withMessage('Password is required.'),
  ],
  handleValidation,
  controller.login
);

// POST /api/auth/logout (requires valid session)
router.post('/logout', csrfProtection, authenticate, controller.logout);

// POST /api/auth/forgot-password
router.post('/forgot-password',
  csrfProtection,
  [body('email').isEmail().normalizeEmail().withMessage('A valid email address is required.')],
  handleValidation,
  controller.forgotPassword
);

// POST /api/auth/reset-password
router.post('/reset-password',
  csrfProtection,
  [
    body('token').notEmpty().withMessage('Reset token is required.'),
    body('password')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters.')
      .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter.')
      .matches(/[0-9]/).withMessage('Password must contain at least one number.'),
  ],
  handleValidation,
  controller.resetPassword
);

module.exports = router;
