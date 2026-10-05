const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const controller = require('./grading.controller');
const { authenticate } = require('../../middleware/auth');
const { authorize } = require('../../middleware/rbac');
const { handleValidation } = require('../../middleware/validate');
const { csrfProtection } = require('../../middleware/csrf');

// Teacher routes
router.get('/:attemptId',        authenticate, authorize('Teacher'), controller.getAttemptForGrading);
router.patch('/:attemptId',      csrfProtection, authenticate, authorize('Teacher'),
  [body('scores').isArray({ min: 1 }).withMessage('Scores array is required.')],
  handleValidation,
  controller.saveManualScores
);
router.patch('/:examId/release', csrfProtection, authenticate, authorize('Teacher'), controller.releaseResults);

// Student route — view own result
router.get('/results/:examId',   authenticate, authorize('Student'), controller.getMyResult);

module.exports = router;
