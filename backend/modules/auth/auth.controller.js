const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const pool = require('../../config/db');

const BCRYPT_ROUNDS = 12;
const LOCKOUT_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const RESET_TOKEN_EXPIRY_HOURS = 1;

// ── Email transporter ─────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

// ── Helper: log audit event ───────────────────────────────────────────────────
async function auditLog(userId, action, ip, metadata = null) {
  await pool.query(
    'INSERT INTO audit_logs (user_id, action, ip_address, metadata) VALUES (?, ?, ?, ?)',
    [userId, action, ip, metadata ? JSON.stringify(metadata) : null]
  );
}

// ── Helper: issue JWT in HttpOnly cookie ──────────────────────────────────────
function issueToken(res, user) {
  const token = jwt.sign(
    { id: user.id, role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRY || '30m' }
  );

  res.cookie('token', token, {
    httpOnly: true,           // prevents JS access — XSS mitigation (OEP-SR-002)
    sameSite: 'strict',       // CSRF mitigation
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 60 * 1000,  // 30 minutes in ms
  });

  return token;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/csrf-token — return CSRF token to client
// ─────────────────────────────────────────────────────────────────────────────
exports.getCsrfToken = (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/register — Student self-registration (OEP-F-001)
// ─────────────────────────────────────────────────────────────────────────────
exports.register = async (req, res, next) => {
  const { fullName, email, password } = req.body;

  try {
    // Check for duplicate email
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({
        error: { code: 'EMAIL_TAKEN', message: 'An account with this email already exists.' },
      });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const [result] = await pool.query(
      'INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [fullName, email, passwordHash, 'Student']
    );

    await auditLog(result.insertId, 'REGISTER', req.ip);

    res.status(201).json({ message: 'Registration successful. Please log in.' });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login — authenticate user, issue JWT (OEP-F-002, OEP-F-003)
// ─────────────────────────────────────────────────────────────────────────────
exports.login = async (req, res, next) => {
  const { email, password } = req.body;

  try {
    const [users] = await pool.query(
      'SELECT id, full_name, email, password_hash, role, is_active, failed_attempts, lockout_until FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'The email or password you entered is incorrect.' },
      });
    }

    const user = users[0];

    // Check if account is deactivated by Admin
    if (!user.is_active) {
      return res.status(403).json({
        error: { code: 'ACCOUNT_DEACTIVATED', message: 'Your account has been deactivated. Contact your administrator.' },
      });
    }

    // Check lockout (OEP-F-003)
    if (user.lockout_until && new Date(user.lockout_until) > new Date()) {
      await auditLog(user.id, 'LOGIN_LOCKED', req.ip);
      return res.status(403).json({
        error: {
          code: 'ACCOUNT_LOCKED',
          message: `Your account is locked due to too many failed attempts. Try again after ${LOCKOUT_MINUTES} minutes.`,
        },
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      const newFailedAttempts = user.failed_attempts + 1;
      let lockoutUntil = null;

      if (newFailedAttempts >= LOCKOUT_ATTEMPTS) {
        lockoutUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
        await pool.query(
          'UPDATE users SET failed_attempts = ?, lockout_until = ? WHERE id = ?',
          [newFailedAttempts, lockoutUntil, user.id]
        );
        await auditLog(user.id, 'LOGIN_LOCKED', req.ip);

        // Notify user via email
        transporter.sendMail({
          from: process.env.EMAIL_FROM,
          to: user.email,
          subject: 'Account Locked — Online Exam Portal',
          text: `Your account has been locked for ${LOCKOUT_MINUTES} minutes due to ${LOCKOUT_ATTEMPTS} failed login attempts.`,
        }).catch(() => {}); // fire-and-forget, don't block response

        return res.status(403).json({
          error: {
            code: 'ACCOUNT_LOCKED',
            message: `Too many failed attempts. Your account has been locked for ${LOCKOUT_MINUTES} minutes.`,
          },
        });
      }

      await pool.query('UPDATE users SET failed_attempts = ? WHERE id = ?', [newFailedAttempts, user.id]);
      await auditLog(user.id, 'LOGIN_FAILED', req.ip);

      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'The email or password you entered is incorrect.' },
      });
    }

    // Reset failed attempts on successful login
    await pool.query(
      'UPDATE users SET failed_attempts = 0, lockout_until = NULL WHERE id = ?',
      [user.id]
    );

    issueToken(res, user);
    await auditLog(user.id, 'LOGIN_SUCCESS', req.ip);

    res.json({ role: user.role, fullName: user.full_name });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/logout — invalidate JWT (OEP-SR-003)
// ─────────────────────────────────────────────────────────────────────────────
exports.logout = async (req, res, next) => {
  try {
    const token = req.token;
    const decoded = jwt.decode(token);
    const expiresAt = decoded?.exp
      ? new Date(decoded.exp * 1000)
      : new Date(Date.now() + 30 * 60 * 1000);

    await pool.query(
      'INSERT INTO token_denylist (token, expires_at) VALUES (?, ?)',
      [token, expiresAt]
    );

    res.clearCookie('token');
    await auditLog(req.user.id, 'LOGOUT', req.ip);

    res.json({ message: 'Logged out successfully.' });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/forgot-password — send reset link (OEP-F-005)
// ─────────────────────────────────────────────────────────────────────────────
exports.forgotPassword = async (req, res, next) => {
  const { email } = req.body;

  try {
    const [users] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);

    // Always return same response to prevent user enumeration
    if (users.length === 0) {
      return res.json({ message: 'If this email is registered, a reset link has been sent.' });
    }

    const userId = users[0].id;
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    // Invalidate any existing unused tokens for this user
    await pool.query(
      'UPDATE password_reset_tokens SET used = 1 WHERE user_id = ? AND used = 0',
      [userId]
    );

    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [userId, token, expiresAt]
    );

    const resetUrl = `${process.env.APP_URL}/reset-password.html?token=${token}`;

    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'Password Reset — Online Exam Portal',
      text: `Click the link below to reset your password. This link expires in 1 hour.\n\n${resetUrl}\n\nIf you did not request this, ignore this email.`,
      html: `<p>Click the link below to reset your password. This link expires in <strong>1 hour</strong>.</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you did not request this, ignore this email.</p>`,
    });

    res.json({ message: 'If this email is registered, a reset link has been sent.' });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/reset-password — update password with valid token (OEP-F-005)
// ─────────────────────────────────────────────────────────────────────────────
exports.resetPassword = async (req, res, next) => {
  const { token, password } = req.body;

  try {
    const [tokens] = await pool.query(
      'SELECT id, user_id, expires_at, used FROM password_reset_tokens WHERE token = ?',
      [token]
    );

    if (tokens.length === 0 || tokens[0].used || new Date(tokens[0].expires_at) < new Date()) {
      return res.status(400).json({
        error: { code: 'INVALID_RESET_TOKEN', message: 'This reset link is invalid or has expired.' },
      });
    }

    const { id: tokenId, user_id: userId } = tokens[0];
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    await pool.query('UPDATE users SET password_hash = ?, failed_attempts = 0, lockout_until = NULL WHERE id = ?', [passwordHash, userId]);
    await pool.query('UPDATE password_reset_tokens SET used = 1 WHERE id = ?', [tokenId]);
    await auditLog(userId, 'PASSWORD_RESET', req.ip);

    res.json({ message: 'Password reset successfully. Please log in.' });
  } catch (err) {
    next(err);
  }
};
