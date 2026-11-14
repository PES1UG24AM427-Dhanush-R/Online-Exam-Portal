
/**
 * Exam Taking Automated Test Suite
 *
 * OEP-F-012: Server-authoritative countdown timer.
 * OEP-F-013: Exam access window enforcement.
 *
 * Tests:
 * 1. Student authentication.
 * 2. Starting an exam within its scheduled window.
 * 3. Correct initial countdown duration.
 * 4. Resuming an in-progress attempt.
 * 5. Remaining time decreases and does not reset.
 * 6. Future exams are rejected.
 * 7. Expired exams are rejected.
 * 8. Draft exams cannot be started.
 */

require('dotenv').config();

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const pool = require('../backend/config/db');

const BASE_URL = process.env.APP_URL || 'http://localhost:3000';
const STUDENT_PASSWORD = 'ExamTakingTest@123';

const UNIQUE = crypto.randomUUID().replace(/-/g, '');
const STUDENT_EMAIL = `taking-test-${UNIQUE}@example.com`;

class SessionClient {
  constructor() {
    this.cookies = new Map();
  }

  updateCookies(response) {
    let cookies = [];

    if (typeof response.headers.getSetCookie === 'function') {
      cookies = response.headers.getSetCookie();
    } else {
      const cookie = response.headers.get('set-cookie');
      if (cookie) cookies = [cookie];
    }

    for (const item of cookies) {
      const parts = item.split(';')[0].split('=');

      if (parts.length >= 2) {
        this.cookies.set(
          parts[0].trim(),
          parts.slice(1).join('=').trim()
        );
      }
    }
  }

  cookieHeader() {
    return Array.from(this.cookies.entries())
      .map(([key, value]) => `${key}=${value}`)
      .join('; ');
  }

  async fetch(url, options = {}) {
    const headers = { ...(options.headers || {}) };
    const cookie = this.cookieHeader();

    if (cookie) headers.Cookie = cookie;

    const response = await fetch(url, {
      ...options,
      headers
    });

    this.updateCookies(response);
    return response;
  }
}

async function readJson(response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Expected JSON response. Received: ${text.slice(0, 300)}`);
  }
}

async function getCsrfToken(client) {
  const response = await client.fetch(
    `${BASE_URL}/api/auth/csrf-token`
  );

  const data = await readJson(response);

  if (!response.ok || !data.csrfToken) {
    throw new Error('Could not obtain CSRF token.');
  }

  return data.csrfToken;
}

async function apiRequest(client, method, endpoint, body) {
  const headers = {
    'Content-Type': 'application/json'
  };

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    headers['X-CSRF-Token'] = await getCsrfToken(client);
  }

  return client.fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    ...(body !== undefined
      ? { body: JSON.stringify(body) }
      : {})
  });
}

async function expectStatus(response, expected, description) {
  const data = await readJson(response);

  if (response.status !== expected) {
    throw new Error(
      `${description}: expected HTTP ${expected}, received ${response.status}. ${JSON.stringify(data)}`
    );
  }

  return data;
}

async function run() {
  const studentClient = new SessionClient();

  let studentId = null;
  let questionId = null;

  const examIds = [];
  const attemptIds = [];

  let passed = 0;

  function pass(message) {
    passed++;
    console.log(`  PASS: ${message}`);
  }

  console.log('================================================');
  console.log(' EXAM TAKING TESTS: OEP-F-012 AND OEP-F-013');
  console.log('================================================');

  try {
    // ------------------------------------------------
    // SETUP: Create temporary Student
    // ------------------------------------------------

    const passwordHash = await bcrypt.hash(STUDENT_PASSWORD, 12);

    const [studentInsert] = await pool.query(
      `INSERT INTO users
       (full_name, email, password_hash, role)
       VALUES (?, ?, ?, 'Student')`,
      [
        'Exam Taking Test Student',
        STUDENT_EMAIL,
        passwordHash
      ]
    );

    studentId = studentInsert.insertId;

    const loginResponse = await apiRequest(
      studentClient,
      'POST',
      '/api/auth/login',
      {
        email: STUDENT_EMAIL,
        password: STUDENT_PASSWORD
      }
    );

    const loginData = await expectStatus(
      loginResponse,
      200,
      'Student login'
    );

    if (loginData.role !== 'Student') {
      throw new Error('Temporary account did not authenticate as Student.');
    }

    pass('Temporary Student account created and authenticated.');

    // ------------------------------------------------
    // SETUP: Create temporary question
    // ------------------------------------------------

    const [questionInsert] = await pool.query(
      `INSERT INTO questions
       (type, text, options, correct_answer, subject, topic,
        difficulty, created_by)
       SELECT 'MCQ_single', ?, ?, ?, ?, ?, 'Easy', id
       FROM users WHERE id = ?`,
      [
        `Exam Taking Test Question ${UNIQUE}`,
        JSON.stringify(['Option A', 'Option B']),
        JSON.stringify('Option A'),
        `TakingTest-${UNIQUE}`,
        `Topic-${UNIQUE}`,
        studentId
      ]
    );

    questionId = questionInsert.insertId;

    pass('Temporary question created.');

    // ------------------------------------------------
    // SETUP: Create active, future, expired and draft exams
    // ------------------------------------------------

    const now = Date.now();

    const examFixtures = [
      {
        name: 'ACTIVE',
        status: 'published',
        start: new Date(now - 10 * 60 * 1000),
        end: new Date(now + 60 * 60 * 1000)
      },
      {
        name: 'FUTURE',
        status: 'published',
        start: new Date(now + 60 * 60 * 1000),
        end: new Date(now + 2 * 60 * 60 * 1000)
      },
      {
        name: 'EXPIRED',
        status: 'published',
        start: new Date(now - 2 * 60 * 60 * 1000),
        end: new Date(now - 60 * 60 * 1000)
      },
      {
        name: 'DRAFT',
        status: 'draft',
        start: new Date(now - 10 * 60 * 1000),
        end: new Date(now + 60 * 60 * 1000)
      }
    ];

    const fixtureIds = {};

    for (const fixture of examFixtures) {
      const [result] = await pool.query(
        `INSERT INTO exams
         (title, duration_minutes, start_datetime, end_datetime,
          shuffle, status, created_by)
         VALUES (?, 30, ?, ?, 0, ?, ?)`,
        [
          `Exam Taking ${fixture.name} ${UNIQUE}`,
          fixture.start,
          fixture.end,
          fixture.status,
          studentId
        ]
      );

      const examId = result.insertId;

      examIds.push(examId);
      fixtureIds[fixture.name] = examId;

      await pool.query(
        `INSERT INTO exam_questions (exam_id, question_id, marks)
         VALUES (?, ?, 5)`,
        [examId, questionId]
      );
    }

    pass('Active, future, expired and draft exam fixtures created.');

    // ------------------------------------------------
    // OEP-F-012: Start active exam
    // ------------------------------------------------

    console.log('\n[TEST F-012] Countdown timer');

    const startResponse = await apiRequest(
      studentClient,
      'POST',
      '/api/attempt/start',
      { examId: fixtureIds.ACTIVE }
    );

    const startData = await expectStatus(
      startResponse,
      201,
      'Start active exam'
    );

    if (!startData.attemptId) {
      throw new Error('Start response did not include an attempt ID.');
    }

    const attemptId = startData.attemptId;
    attemptIds.push(attemptId);

    if (Number(startData.durationSeconds) !== 1800) {
      throw new Error(
        `Expected 1800 duration seconds, received ${startData.durationSeconds}.`
      );
    }

    pass('Student can start an exam within its scheduled window.');

    if (Number(startData.remainingSeconds) !== 1800) {
      throw new Error(
        `Expected initial remaining time of 1800 seconds, received ${startData.remainingSeconds}.`
      );
    }

    pass('Initial countdown equals the configured 30-minute duration.');

    if (!startData.serverTime || Number.isNaN(Date.parse(startData.serverTime))) {
      throw new Error('Server time was missing or invalid.');
    }

    pass('Server timestamp is returned with the attempt.');

    // ------------------------------------------------
    // OEP-F-012: Simulate elapsed time and resume
    // ------------------------------------------------

    await pool.query(
      `UPDATE attempts
       SET start_time = DATE_SUB(NOW(), INTERVAL 120 SECOND)
       WHERE id = ?`,
      [attemptId]
    );

    const resumeResponse = await apiRequest(
      studentClient,
      'POST',
      '/api/attempt/start',
      { examId: fixtureIds.ACTIVE }
    );

    const resumeData = await expectStatus(
      resumeResponse,
      200,
      'Resume in-progress exam'
    );

    if (Number(resumeData.attemptId) !== Number(attemptId)) {
      throw new Error('Resume created a different attempt instead of reusing the existing one.');
    }

    pass('Existing in-progress attempt is resumed.');

    if (
      Number(resumeData.remainingSeconds) >=
      Number(startData.remainingSeconds)
    ) {
      throw new Error(
        `Timer did not decrease. Initial: ${startData.remainingSeconds}, resumed: ${resumeData.remainingSeconds}.`
      );
    }

    if (
      Number(resumeData.remainingSeconds) >
      Number(startData.remainingSeconds) - 100
    ) {
      throw new Error(
        `Expected at least 100 seconds elapsed. Remaining: ${resumeData.remainingSeconds}.`
      );
    }

    pass('Remaining time decreases based on server-side start time.');

    if (Number(resumeData.durationSeconds) !== 1800) {
      throw new Error('Configured exam duration changed during resume.');
    }

    pass('Original exam duration is preserved after reconnect.');

    // ------------------------------------------------
    // OEP-F-013: Future exam access
    // ------------------------------------------------

    console.log('\n[TEST F-013] Exam availability window');

    const futureResponse = await apiRequest(
      studentClient,
      'POST',
      '/api/attempt/start',
      { examId: fixtureIds.FUTURE }
    );

    const futureData = await readJson(futureResponse);

    if (
      futureResponse.status !== 403 ||
      futureData.error?.code !== 'EXAM_NOT_STARTED'
    ) {
      throw new Error(
        `Future exam should return 403 EXAM_NOT_STARTED. Received ${futureResponse.status}: ${JSON.stringify(futureData)}`
      );
    }

    pass('Future exam is rejected before its scheduled start.');

    // ------------------------------------------------
    // OEP-F-013: Expired exam access
    // ------------------------------------------------

    const expiredResponse = await apiRequest(
      studentClient,
      'POST',
      '/api/attempt/start',
      { examId: fixtureIds.EXPIRED }
    );

    const expiredData = await readJson(expiredResponse);

    if (
      expiredResponse.status !== 403 ||
      expiredData.error?.code !== 'EXAM_ENDED'
    ) {
      throw new Error(
        `Expired exam should return 403 EXAM_ENDED. Received ${expiredResponse.status}: ${JSON.stringify(expiredData)}`
      );
    }

    pass('Expired exam is rejected after its scheduled end.');

    // ------------------------------------------------
    // OEP-F-013: Draft exam access
    // ------------------------------------------------

    const draftResponse = await apiRequest(
      studentClient,
      'POST',
      '/api/attempt/start',
      { examId: fixtureIds.DRAFT }
    );

    const draftData = await readJson(draftResponse);

    if (
      draftResponse.status !== 404 ||
      draftData.error?.code !== 'EXAM_NOT_FOUND'
    ) {
      throw new Error(
        `Draft exam should not be startable. Received ${draftResponse.status}: ${JSON.stringify(draftData)}`
      );
    }

    pass('Unpublished draft exam cannot be started.');

    // ------------------------------------------------
    // Summary
    // ------------------------------------------------

    console.log('\n================================================');
    console.log(' EXAM TAKING TESTS COMPLETED');
    console.log(` PASSED: ${passed}`);
    console.log(' FAILED: 0');
    console.log(' OEP-F-012 AND OEP-F-013');
    console.log('================================================');

  } catch (error) {
    console.error('\n>>> TEST FAILED:', error.message);
    process.exitCode = 1;

  } finally {
    console.log('\nCleaning up temporary test data...');

    try {
      if (attemptIds.length > 0) {
        const placeholders = attemptIds.map(() => '?').join(',');

        await pool.query(
          `DELETE FROM answers WHERE attempt_id IN (${placeholders})`,
          attemptIds
        );

        await pool.query(
          `DELETE FROM attempts WHERE id IN (${placeholders})`,
          attemptIds
        );
      }

      if (examIds.length > 0) {
        const placeholders = examIds.map(() => '?').join(',');

        await pool.query(
          `DELETE FROM exams WHERE id IN (${placeholders})`,
          examIds
        );
      }

      if (questionId) {
        await pool.query(
          'DELETE FROM questions WHERE id = ?',
          [questionId]
        );
      }

      if (studentId) {
        await pool.query(
          'DELETE FROM audit_logs WHERE user_id = ?',
          [studentId]
        );

        await pool.query(
          'DELETE FROM password_reset_tokens WHERE user_id = ?',
          [studentId]
        );

        await pool.query(
          'DELETE FROM users WHERE id = ?',
          [studentId]
        );
      }

      console.log('Temporary test data cleanup completed.');

    } catch (cleanupError) {
      console.error('Cleanup failed:', cleanupError.message);
      process.exitCode = 1;
    }

    await pool.end();
  }
}

run();
