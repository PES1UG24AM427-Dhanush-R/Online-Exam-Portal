const { validationResult } = require('express-validator');

/**
 * Runs after express-validator chains.
 * Returns 400 with all validation errors if any field is invalid.
 * Satisfies: OEP-SR-004
 */
function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'One or more fields are invalid.',
        details: errors.array().map((e) => ({ field: e.path, message: e.msg })),
      },
    });
  }
  next();
}

module.exports = { handleValidation };
