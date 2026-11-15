const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const controller = require('./examTaking.controller');
const { authenticate } = require('../../middleware/auth');
const { authorize } = require('../../middleware/rbac');
const { handleValidation } = require('../../middleware/validate');
const { csrfProtection } = require('../../middleware/csrf');

router.post('/start',
  csrfProtection,
  authenticate,
  authorize('Student'),
  [body('examId').isInt({ min: 1 }).withMessage('A valid exam ID is required.')],
  handleValidation,
  controller.startAttempt
);

router.post('/:id/autosave',
  csrfProtection,
  authenticate,
  authorize('Student'),
  [body('answers').isArray().withMessage('Answers must be an array.')],
  handleValidation,
  controller.autosave
);

router.post('/:id/submit',
  csrfProtection,
  authenticate,
  authorize('Student'),
  [body('answers').isArray().withMessage('Answers must be an array.')],
  handleValidation,
  controller.submit
);

module.exports = router;

// OEP-F-012: finalize expired attempts server-side even when the student's
// browser is closed (disabled under NODE_ENV=test). Started once on load.
require('./expirySweeper').start();
