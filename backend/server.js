require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// CORS — allow frontend origin with credentials (cookies)
app.use(cors({
  origin: process.env.APP_URL || 'http://localhost:3000',
  credentials: true,
}));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',      require('./modules/auth/auth.routes'));
app.use('/api/questions', require('./modules/questionBank/questionBank.routes'));
app.use('/api/exams',     require('./modules/exam/exam.routes'));
app.use('/api/attempt',   require('./modules/examTaking/examTaking.routes'));
app.use('/api/grading',   require('./modules/grading/grading.routes'));
app.use('/api/admin',     require('./modules/admin/admin.routes'));

// ── Health check endpoint (OEP-F-020) ────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  const pool = require('./config/db');
  try {
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS active_exams FROM attempts WHERE status = 'in_progress'`
    );
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      activeExamSessions: rows[0].active_exams,
      timestamp: new Date().toISOString(),
    });
  } catch {
    res.status(500).json({ status: 'degraded', message: 'Database unreachable' });
  }
});

// ── Global error handler (OEP-NF-004) ────────────────────────────────────────
// Never expose stack traces or internal details to the client
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);

  // CSRF token errors
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({
      error: { code: 'INVALID_CSRF_TOKEN', message: 'Form submission could not be verified.' },
    });
  }

  const status = err.status || 500;
  const message = status < 500
    ? err.message
    : 'Something went wrong. Please try again later.';

  res.status(status).json({
    error: { code: err.code || 'INTERNAL_ERROR', message },
  });
});

// ── Start server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Online Exam Portal running on port ${PORT}`);
});

module.exports = app;
