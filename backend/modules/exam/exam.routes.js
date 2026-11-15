const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const controller = require('./exam.controller');
const { authenticate } = require('../../middleware/auth');
const { authorize } = require('../../middleware/rbac');
const { handleValidation } = require('../../middleware/validate');
const { csrfProtection } = require('../../middleware/csrf');

const examValidation = [
  body('title').trim().notEmpty().withMessage('Exam title is required.'),
  body('durationMinutes').isInt({ min: 1 }).withMessage('Duration must be a positive integer.'),
  body('startDatetime').isISO8601().withMessage('Start date/time must be a valid ISO8601 datetime.'),
  body('endDatetime').isISO8601().withMessage('End date/time must be a valid ISO8601 datetime.'),
  // OEP-F-010: an exam's end datetime must be later than its start datetime (create and update)
  body('endDatetime')
    .custom((value, { req }) => {
      const start = req.body.startDatetime;
      if (!start) return true;
      const s = new Date(start);
      const e = new Date(value);
      if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return true;
      if (e <= s) {
        throw new Error('End date/time must be later than the start date/time.');
      }
      return true;
    }),
  body('questions').isArray({ min: 1 }).withMessage('At least one question is required.'),
];

router.get('/',           authenticate, authorize('Teacher', 'Student'), controller.listExams);
router.get('/:id',        authenticate, authorize('Teacher', 'Student'), controller.getExam);
router.post('/',          csrfProtection, authenticate, authorize('Teacher'), examValidation, handleValidation, controller.createExam);
router.put('/:id',        csrfProtection, authenticate, authorize('Teacher'), examValidation, handleValidation, controller.updateExam);
router.patch('/:id/publish', csrfProtection, authenticate, authorize('Teacher'), controller.publishExam);

module.exports = router;
