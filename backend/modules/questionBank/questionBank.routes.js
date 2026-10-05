const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const controller = require('./questionBank.controller');
const { authenticate } = require('../../middleware/auth');
const { authorize } = require('../../middleware/rbac');
const { handleValidation } = require('../../middleware/validate');
const { csrfProtection } = require('../../middleware/csrf');

const questionValidation = [
  body('type').isIn(['MCQ_single', 'MCQ_multiple', 'TrueFalse', 'ShortAnswer']).withMessage('Invalid question type.'),
  body('text').trim().notEmpty().withMessage('Question text is required.'),
  body('correctAnswer').notEmpty().withMessage('Correct answer is required.'),
  body('subject').trim().notEmpty().withMessage('Subject is required.'),
  body('topic').trim().notEmpty().withMessage('Topic is required.'),
  body('difficulty').isIn(['Easy', 'Medium', 'Hard']).withMessage('Difficulty must be Easy, Medium, or Hard.'),
];

// All routes require authentication and Teacher role
router.get('/',    authenticate, authorize('Teacher'), controller.listQuestions);
router.post('/',   csrfProtection, authenticate, authorize('Teacher'), questionValidation, handleValidation, controller.createQuestion);
router.put('/:id', csrfProtection, authenticate, authorize('Teacher'), questionValidation, handleValidation, controller.updateQuestion);
router.delete('/:id', csrfProtection, authenticate, authorize('Teacher'), controller.deleteQuestion);

module.exports = router;
