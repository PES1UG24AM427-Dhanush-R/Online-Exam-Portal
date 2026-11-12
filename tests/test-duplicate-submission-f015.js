
/**
 * Automated Verification Test for OEP-F-015:
 * Duplicate Exam Submission Prevention
 *
 * Test Case Traceability: STP TC-Take-04 / SRS OEP-F-015
 *
 * Verifies:
 * 1. Initial exam submission succeeds.
 * 2. Attempt is marked submitted with a timestamp.
 * 3. Duplicate submission is rejected with HTTP 409.
 * 4. Restarting a submitted exam is rejected.
 * 5. Autosaving a submitted exam is rejected.
 * 6. Original answers remain unchanged.
 */

require('dotenv').config();
const pool = require('../backend/config/db');

const BASE_URL = process.env.APP_URL || 'http://localhost:3000';
const STUDENT_EMAIL = 'student@test.com';
const STUDENT_PASSWORD = 'Student@123';
const EXAM_ID = 2;

class SessionClient {
  constructor() {
    this.cookies = new Map();
  }

  updateCookies(res) {
    let raw = [];

    if (typeof res.headers.getSetCookie === 'function') {
      raw = res.headers.getSetCookie();
    } else {
      const header = res.headers.get('set-cookie');
      if (header) raw = [header];
    }

    for (const cookie of raw) {
      const parts = cookie.split(';')[0].split('=');

      if (parts.length >= 2) {
        this.cookies.set(
          parts[0].trim(),
          parts.slice(1).join('=').trim()
        );
      }
    }
  }

  getCookieHeader() {
    return Array.from(this.cookies.entries())
      .map(([key, value]) => `${key}=${value}`)
      .join('; ');
  }

  async fetch(url, options = {}) {
    options.headers = options.headers || {};

    const cookie = this.getCookieHeader();
    if (cookie) options.headers.Cookie = cookie;

    const res = await fetch(url, options);
    this.updateCookies(res);

    return res;
  }
}

async function run() {
  console.log(
    '=== Starting Test: OEP-F-015 (Duplicate Submission Prevention) ===\n'
  );

  const client = new SessionClient();

  try {
    // 1. Find the test Student dynamically.
    const [students] = await pool.query(
      `SELECT id FROM users
       WHERE email = ? AND role = 'Student' AND is_active = 1`,
      [STUDENT_EMAIL]
    );

    if (students.length === 0) {
      throw new Error(`Active Student account not found: ${STUDENT_EMAIL}`);
    }

    const studentId = students[0].id;
    console.log(`[1] Test Student found. ID: ${studentId}`);

    // 2. Ensure Exam 2 exists and is open.
    const [exams] = await pool.query(
      'SELECT id FROM exams WHERE id = ?',
      [EXAM_ID]
    );

    if (exams.length === 0) {
      throw new Error(`Exam ${EXAM_ID} does not exist.`);
    }

    const now = new Date();
    const start = new Date(now.getTime() - 10 * 60 * 1000);
    const end = new Date(now.getTime() + 50 * 60 * 1000);

    await pool.query(
      `UPDATE exams
       SET status = 'published',
           start_datetime = ?,
           end_datetime = ?,
           duration_minutes = 60
       WHERE id = ?`,
      [start, end, EXAM_ID]
    );

    // 3. Ensure the test questions are linked to the exam.
    await pool.query(
      `INSERT IGNORE INTO exam_questions
       (exam_id, question_id, marks)
       VALUES (?, 1, 2.00), (?, 2, 2.00)`,
      [EXAM_ID, EXAM_ID]
    );

    // 4. Reset only this Student's previous attempt.
    await pool.query(
      `DELETE FROM answers
       WHERE attempt_id IN (
         SELECT id FROM attempts
         WHERE student_id = ? AND exam_id = ?
       )`,
      [studentId, EXAM_ID]
    );

    await pool.query(
      'DELETE FROM attempts WHERE student_id = ? AND exam_id = ?',
      [studentId, EXAM_ID]
    );

    console.log('[2] Exam and database state prepared.');

    // 5. Obtain CSRF token.
    const csrfRes = await client.fetch(
      `${BASE_URL}/api/auth/csrf-token`
    );

    const csrfData = await csrfRes.json();
    let csrfToken = csrfData.csrfToken;

    if (!csrfRes.ok || !csrfToken) {
      throw new Error('Could not obtain CSRF token.');
    }

    console.log('[3] CSRF token obtained.');

    // 6. Login as test Student.
    const loginRes = await client.fetch(
      `${BASE_URL}/api/auth/login`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({
          email: STUDENT_EMAIL,
          password: STUDENT_PASSWORD
        })
      }
    );

    const loginData = await loginRes.json();

    if (!loginRes.ok) {
      throw new Error(
        `Login failed (${loginRes.status}): ${JSON.stringify(loginData)}`
      );
    }

    console.log('[4] Student login successful.');

    // Refresh CSRF token after login.
    const csrfRes2 = await client.fetch(
      `${BASE_URL}/api/auth/csrf-token`
    );

    const csrfData2 = await csrfRes2.json();
    csrfToken = csrfData2.csrfToken;

    // 7. Start exam attempt.
    const startRes = await client.fetch(
      `${BASE_URL}/api/attempt/start`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({ examId: EXAM_ID })
      }
    );

    const startData = await startRes.json();

    if (!startRes.ok) {
      throw new Error(
        `Start attempt failed: ${JSON.stringify(startData)}`
      );
    }

    const attemptId = startData.attemptId;

    console.log(`[5] Started attempt #${attemptId}.`);

    // 8. Submit answers for the first time.
    const originalAnswers = [
      { questionId: 1, response: 'Option A' },
      { questionId: 2, response: 'True' }
    ];

    const submitRes1 = await client.fetch(
      `${BASE_URL}/api/attempt/${attemptId}/submit`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({ answers: originalAnswers })
      }
    );

    const submitData1 = await submitRes1.json();

    console.log(
      '[6] First submission response:',
      submitRes1.status,
      submitData1.message
    );

    if (submitRes1.status !== 200) {
      throw new Error(
        `Expected first submission to return 200, got ${submitRes1.status}: ${JSON.stringify(submitData1)}`
      );
    }

    // 9. Verify submitted status and timestamp in database.
    const [attemptRows] = await pool.query(
      'SELECT status, submitted_at FROM attempts WHERE id = ?',
      [attemptId]
    );

    if (
      attemptRows.length === 0 ||
      attemptRows[0].status !== 'submitted' ||
      !attemptRows[0].submitted_at
    ) {
      throw new Error(
        `Attempt was not marked submitted correctly: ${JSON.stringify(attemptRows[0])}`
      );
    }

    console.log(
      '[7] Database confirms submitted status and timestamp:',
      attemptRows[0].submitted_at
    );

    // 10. Try submitting the same attempt again.
    console.log('[8] Testing duplicate submission...');

    const submitRes2 = await client.fetch(
      `${BASE_URL}/api/attempt/${attemptId}/submit`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({
          answers: [
            { questionId: 1, response: 'Option B' }
          ]
        })
      }
    );

    const submitData2 = await submitRes2.json();

    console.log(
      '[9] Duplicate submission response:',
      submitRes2.status,
      submitData2.error?.code
    );

    if (
      submitRes2.status !== 409 ||
      submitData2.error?.code !== 'ALREADY_SUBMITTED'
    ) {
      throw new Error(
        `Expected 409 ALREADY_SUBMITTED, got ${submitRes2.status}: ${JSON.stringify(submitData2)}`
      );
    }

    // 11. Try restarting the submitted exam.
    console.log('[10] Testing restart of submitted exam...');

    const startRes2 = await client.fetch(
      `${BASE_URL}/api/attempt/start`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({ examId: EXAM_ID })
      }
    );

    const startData2 = await startRes2.json();

    if (
      startRes2.status !== 409 ||
      startData2.error?.code !== 'ALREADY_SUBMITTED'
    ) {
      throw new Error(
        `Expected 409 ALREADY_SUBMITTED on restart, got ${startRes2.status}: ${JSON.stringify(startData2)}`
      );
    }

    console.log('[11] Restart correctly rejected.');

    // 12. Try autosaving the submitted attempt.
    console.log('[12] Testing autosave on submitted attempt...');

    const autosaveRes = await client.fetch(
      `${BASE_URL}/api/attempt/${attemptId}/autosave`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({
          answers: [
            { questionId: 1, response: 'Tampered Answer' }
          ]
        })
      }
    );

    const autosaveData = await autosaveRes.json();

    if (
      autosaveRes.status !== 409 ||
      autosaveData.error?.code !== 'ALREADY_SUBMITTED'
    ) {
      throw new Error(
        `Expected 409 ALREADY_SUBMITTED on autosave, got ${autosaveRes.status}: ${JSON.stringify(autosaveData)}`
      );
    }

    console.log('[13] Autosave correctly rejected.');

    // 13. Verify original answers remain unchanged.
    const [preservedAnswers] = await pool.query(
      `SELECT question_id, response
       FROM answers
       WHERE attempt_id = ?
       ORDER BY question_id ASC`,
      [attemptId]
    );

    if (
      preservedAnswers.length !== 2 ||
      preservedAnswers[0].question_id !== 1 ||
      preservedAnswers[0].response !== 'Option A' ||
      preservedAnswers[1].question_id !== 2 ||
      preservedAnswers[1].response !== 'True'
    ) {
      throw new Error(
        `Original answers were overwritten or corrupted: ${JSON.stringify(preservedAnswers)}`
      );
    }

    console.log('[14] Original answers remain unchanged.');

    console.log(
      '\n>>> SUCCESS: TC-Take-04 / OEP-F-015 PASSED! Duplicate submission prevented.\n'
    );

  } catch (err) {
    console.error('\n>>> TEST FAILED:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
