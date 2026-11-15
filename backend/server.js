
require('dotenv').config();

const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(cors({
  origin: process.env.APP_URL || 'http://localhost:3000',
  credentials: true,
}));

app.use(express.static(path.join(__dirname, '../frontend')));

// API Routes
app.use('/api/auth', require('./modules/auth/auth.routes'));
app.use('/api/questions', require('./modules/questionBank/questionBank.routes'));
app.use('/api/exams', require('./modules/exam/exam.routes'));
app.use('/api/attempt', require('./modules/examTaking/examTaking.routes'));
app.use('/api/grading', require('./modules/grading/grading.routes'));
app.use('/api/admin', require('./modules/admin/admin.routes'));

// Health check
app.get('/api/health', async (req, res) => {
  const pool = require('./config/db');
  const uptimeService = require('./modules/monitoring/uptime.service');

  try {
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS active_exams FROM attempts WHERE status = 'in_progress'`
    );

    const summary = await uptimeService.getUptimeSummary();

    res.json({
      status: 'ok',
      uptime: process.uptime(),
      uptimePercentage: summary.monthlyUptimePercentage,
      slaTarget: summary.targetSla,
      slaMet: summary.isSlaMet,
      activeExamSessions: rows[0].active_exams,
      timestamp: new Date().toISOString(),
    });
  } catch {
    res.status(500).json({
      status: 'degraded',
      message: 'Database unreachable'
    });
  }
});

// 404 handler
app.use('/api', (req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'The requested API endpoint was not found.'
    },
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);

  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({
      error: {
        code: 'INVALID_CSRF_TOKEN',
        message: 'Form submission could not be verified.'
      },
    });
  }

  if (
    err instanceof SyntaxError &&
    err.status === 400 &&
    'body' in err
  ) {
    return res.status(400).json({
      error: {
        code: 'BAD_REQUEST',
        message: 'Invalid JSON payload provided.'
      },
    });
  }

  const status = err.status || 500;
  const isInternal =
    status >= 500 ||
    (err.code && err.code.startsWith('ER_'));

  const code = isInternal
    ? 'INTERNAL_ERROR'
    : (err.code || 'BAD_REQUEST');

  const message = isInternal
    ? 'Something went wrong. Please try again later.'
    : err.message;

  res.status(status >= 500 ? 500 : status).json({
    error: { code, message },
  });
});

// Start HTTP and HTTPS servers
const HTTP_PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;

const certDirectory = path.join(__dirname, '../certs');

const httpsOptions = {
  key: fs.readFileSync(
    path.join(certDirectory, 'localhost-key.pem')
  ),
  cert: fs.readFileSync(
    path.join(certDirectory, 'localhost-cert.pem')
  ),
};

// Redirect HTTP requests to HTTPS
http.createServer((req, res) => {
  const host = req.headers.host || 'localhost';

  res.writeHead(301, {
    Location: `https://${host.split(':')[0]}:${HTTPS_PORT}${req.url}`
  });

  res.end();
}).listen(HTTP_PORT, () => {
  console.log(`HTTP redirect server running on port ${HTTP_PORT}`);
});

// HTTPS application server
https.createServer(httpsOptions, app).listen(HTTPS_PORT, () => {
  console.log(`Online Exam Portal HTTPS running on port ${HTTPS_PORT}`);
});

module.exports = app;
