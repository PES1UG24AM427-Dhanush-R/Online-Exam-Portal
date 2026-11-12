
/**
 * Automated Verification Test for OEP-F-014: Auto-Save Answers Every 60 Seconds
 *
 * Test Case Traceability: STP TC-Take-03 / SRS OEP-F-014
 *
 * Verifies:
 * 1. Student answers can be auto-saved via POST /api/attempt/:id/autosave.
 * 2. Database records the upserted answers.
 * 3. On reconnect, saved answers are restored.
 * 4. Timer does not reset upon reconnect.
 */

require('dotenv').config();
const pool = require('../backend/config/db');

const BASE_URL = process.env.APP_URL || 'http://localhost:3000';
const STUDENT_EMAIL = 'student@test.com';
const STUDENT_PASSWORD = 'Student@123';

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
  console.log('=== Starting Test: OEP-F-014 (Auto-Save & Restoration) ===\n');

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

    // 2. Ensure Exam 2 is published and open.
    const now = new Date();
    const start = new Date(now.getTime() - 15 * 60 * 1000);
    const end = new Date(now.getTime() + 45 * 60 * 1000);

    await pool.query(
      `UPDATE exams
       SET status = 'published',
           start_datetime = ?,
           end_datetime = ?,
           duration_minutes = 60
       WHERE id = 2`,
      [start, end]
    );

    const [exams] = await pool.query(
      'SELECT id FROM exams WHERE id = 2'
    );

    if (exams.length === 0) {
      throw new Error('Exam 2 does not exist in the database.');
    }

    // 3. Ensure questions are linked to Exam 2.
    await pool.query(
      `INSERT IGNORE INTO exam_questions (exam_id, question_id, marks)
       VALUES (2, 1, 2.00), (2, 2, 2.00)`
    );

    // 4. Reset only this test Student's previous attempt.
    await pool.query(
      `DELETE FROM answers
       WHERE attempt_id IN (
         SELECT id FROM attempts
         WHERE student_id = ? AND exam_id = 2
       )`,
      [studentId]
    );

    await pool.query(
      'DELETE FROM attempts WHERE student_id = ? AND exam_id = 2',
      [studentId]
    );

    console.log('[2] Exam and database state prepared.');

    // 5. Fetch initial CSRF token.
    const csrfRes = await client.fetch(
      `${BASE_URL}/api/auth/csrf-token`
    );

    const csrfData = await csrfRes.json();
    let csrfToken = csrfData.csrfToken;

    if (!csrfRes.ok || !csrfToken) {
      throw new Error('Could not obtain initial CSRF token.');
    }

    console.log('[3] CSRF token obtained.');

    // 6. Login as the test Student.
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
        `Login failed with status ${loginRes.status}: ${JSON.stringify(loginData)}`
      );
    }

    console.log('[4] Student login successful.');

    // Fetch refreshed CSRF token.
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
        body: JSON.stringify({ examId: 2 })
      }
    );

    const startData = await startRes.json();

    if (!startRes.ok) {
      throw new Error(
        `Start attempt failed: ${JSON.stringify(startData)}`
      );
    }

    const attemptId = startData.attemptId;

    console.log(
      `[5] Started attempt #${attemptId}. Remaining time: ${startData.remainingSeconds}s`
    );

    // 8. Test auto-save.
    const answersToSave = [
      { questionId: 1, response: 'Option A' },
      { questionId: 2, response: 'True' }
    ];

    const autosaveRes = await client.fetch(
      `${BASE_URL}/api/attempt/${attemptId}/autosave`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({ answers: answersToSave })
      }
    );

    const autosaveData = await autosaveRes.json();

    if (!autosaveRes.ok) {
      throw new Error(
        `Autosave failed: ${JSON.stringify(autosaveData)}`
      );
    }

    console.log('[6] Auto-save request succeeded:', autosaveData.message);

    // 9. Verify database answers.
    const [dbAnswers] = await pool.query(
      `SELECT question_id, response
       FROM answers
       WHERE attempt_id = ?
       ORDER BY question_id ASC`,
      [attemptId]
    );

    if (
      dbAnswers.length !== 2 ||
      dbAnswers[0].response !== 'Option A' ||
      dbAnswers[1].response !== 'True'
    ) {
      throw new Error(
        `Database answers do not match expected values: ${JSON.stringify(dbAnswers)}`
      );
    }

    console.log('[7] Database answers verified.');

    // 10. Simulate disconnect and reconnect.
    console.log('[8] Simulating reconnect to ongoing exam...');

    const reconnectRes = await client.fetch(
      `${BASE_URL}/api/attempt/start`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({ examId: 2 })
      }
    );

    const reconnectData = await reconnectRes.json();

    if (!reconnectRes.ok) {
      throw new Error(
        `Reconnect failed: ${JSON.stringify(reconnectData)}`
      );
    }

    console.log('[9] Reconnect response received.');
    console.log('    Restored answers:', reconnectData.savedAnswers);
    console.log(
      `    Remaining seconds: ${reconnectData.remainingSeconds}s`
    );

    // 11. Verify restored answers.
    const restoredMap = {};

    reconnectData.savedAnswers.forEach((answer) => {
      restoredMap[answer.questionId] = answer.response;
    });

    if (
      restoredMap[1] !== 'Option A' ||
      restoredMap[2] !== 'True'
    ) {
      throw new Error(
        `Restored answers do not match: ${JSON.stringify(restoredMap)}`
      );
    }

    console.log('[10] Saved answers successfully restored.');

    // 12. Verify timer has not reset.
    if (
      reconnectData.remainingSeconds > startData.remainingSeconds
    ) {
      throw new Error(
        `Timer reset detected! Original: ${startData.remainingSeconds}, Reconnected: ${reconnectData.remainingSeconds}`
      );
    }

    console.log('[11] Server-authoritative timer verified.');

    console.log(
      '\n>>> SUCCESS: TC-Take-03 / OEP-F-014 PASSED! Auto-save and restoration verified.\n'
    );

  } catch (err) {
    console.error('\n>>> TEST FAILED:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
