const jwt = require('jsonwebtoken');
const pool = require('../config/db');

/**
 * Verifies the JWT from the HttpOnly cookie.
 * Rejects tokens that have been denylisted (logged-out sessions).
 * Attaches req.user = { id, role, email } on success.
 * Satisfies: OEP-SR-003
 */
async function authenticate(req, res, next) {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({
      error: { code: 'NO_TOKEN', message: 'Authentication required. Please log in.' },
    });
  }

  try {
    // Verify signature and expiry
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check token denylist (handles logout invalidation)
    const [rows] = await pool.query(
      'SELECT id FROM token_denylist WHERE token = ? AND expires_at > NOW()',
      [token]
    );
    if (rows.length > 0) {
      return res.status(401).json({
        error: { code: 'TOKEN_INVALIDATED', message: 'Session has been invalidated. Please log in again.' },
      });
    }

    req.user = { id: decoded.id, role: decoded.role, email: decoded.email };
    req.token = token;
    next();
  } catch (err) {
    return res.status(401).json({
      error: { code: 'INVALID_TOKEN', message: 'Session expired or invalid. Please log in again.' },
    });
  }
}

module.exports = { authenticate };
