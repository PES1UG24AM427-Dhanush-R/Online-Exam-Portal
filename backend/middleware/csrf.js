const csurf = require('csurf');

/**
 * CSRF protection for all state-changing routes (POST, PUT, PATCH, DELETE).
 * Token is sent to the client via GET /api/auth/csrf-token and must be
 * included as the X-CSRF-Token header on every mutating request.
 * Satisfies: OEP-SR-005
 */
const csrfProtection = csurf({ cookie: { httpOnly: true, sameSite: 'strict' } });

module.exports = { csrfProtection };
