const bcrypt = require('bcrypt');
const pool = require('../../config/db');

const BCRYPT_ROUNDS = 12;

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/users — list all users (OEP-F-019)
// ─────────────────────────────────────────────────────────────────────────────
exports.listUsers = async (req, res, next) => {
  const { role, is_active, search } = req.query;

  try {
    let query = 'SELECT id, full_name, email, role, is_active, created_at FROM users WHERE 1=1';
    const params = [];

    if (role)      { query += ' AND role = ?';      params.push(role); }
    if (is_active !== undefined) { query += ' AND is_active = ?'; params.push(is_active); }
    if (search)    { query += ' AND (full_name LIKE ? OR email LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

    query += ' ORDER BY created_at DESC';

    const [users] = await pool.query(query, params);
    res.json({ users });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/users — create user (OEP-F-019)
// ─────────────────────────────────────────────────────────────────────────────
exports.createUser = async (req, res, next) => {
  const { fullName, email, password, role } = req.body;

  try {
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({
        error: { code: 'EMAIL_TAKEN', message: 'An account with this email already exists.' },
      });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const [result] = await pool.query(
      'INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [fullName, email, passwordHash, role]
    );

    res.status(201).json({ message: 'User created successfully.', userId: result.insertId });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/admin/users/:id — update role or active status (OEP-F-019)
// ─────────────────────────────────────────────────────────────────────────────
exports.updateUser = async (req, res, next) => {
  const { id } = req.params;
  const { role, isActive } = req.body;

  try {
    const [users] = await pool.query('SELECT id FROM users WHERE id = ?', [id]);
    if (users.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found.' } });
    }

    // Prevent Admin from deactivating themselves
    if (parseInt(id) === req.user.id && isActive === false) {
      return res.status(400).json({
        error: { code: 'SELF_DEACTIVATE', message: 'You cannot deactivate your own account.' },
      });
    }

    const updates = [];
    const params = [];

    if (role !== undefined)     { updates.push('role = ?');      params.push(role); }
    if (isActive !== undefined) { updates.push('is_active = ?'); params.push(isActive ? 1 : 0); }

    if (updates.length === 0) {
      return res.status(400).json({ error: { code: 'NO_CHANGES', message: 'No changes provided.' } });
    }

    params.push(id);
    await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

    res.json({ message: 'User updated successfully.' });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/admin/users/:id — delete user (OEP-F-019)
// ─────────────────────────────────────────────────────────────────────────────
exports.deleteUser = async (req, res, next) => {
  const { id } = req.params;

  try {
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({
        error: { code: 'SELF_DELETE', message: 'You cannot delete your own account.' },
      });
    }

    const [users] = await pool.query('SELECT id FROM users WHERE id = ?', [id]);
    if (users.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found.' } });
    }

    await pool.query('DELETE FROM users WHERE id = ?', [id]);
    res.json({ message: 'User deleted successfully.' });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/dashboard — system health dashboard (OEP-F-020)
// ─────────────────────────────────────────────────────────────────────────────
exports.getDashboard = async (req, res, next) => {
  try {
    const [[activeExams]] = await pool.query(
      `SELECT COUNT(DISTINCT a.exam_id) AS active_exam_count
       FROM attempts a WHERE a.status = 'in_progress'`
    );

    const [activeExamDetails] = await pool.query(
      `SELECT e.id, e.title,
              COUNT(a.id) AS students_currently_taking
       FROM exams e
       JOIN attempts a ON e.id = a.exam_id
       WHERE a.status = 'in_progress'
       GROUP BY e.id, e.title`
    );

    const [[userCounts]] = await pool.query(
      `SELECT
        SUM(role = 'Student') AS students,
        SUM(role = 'Teacher') AS teachers,
        SUM(role = 'Admin')   AS admins,
        SUM(is_active = 0)    AS deactivated
       FROM users`
    );

    res.json({
      systemHealth: { status: 'ok', uptime: process.uptime() },
      activeExamCount: activeExams.active_exam_count,
      activeExams: activeExamDetails,
      userCounts,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
};
