
/**
 * Automated Verification Test for OEP-F-015: Duplicate Exam Submission Prevention
 *
 * Test Case Traceability: STP TC-Take-04 / SRS OEP-F-015
 *
 * Verifies:
 * 1. A student can start an exam attempt.
 * 2. Two simultaneous submission requests cannot both succeed.
 * 3. Exactly one concurrent submission succeeds (HTTP 200).
 * 4. The duplicate submission is rejected (HTTP 409 ALREADY_SUBMITTED).
 * 5. The attempt is marked as submitted with a valid timestamp.
 * 6. Restarting or autosaving a submitted attempt is rejected.
 * 7. Original answers remain preserved and uncorrupted.
 */

require('dotenv').config();
const pool = require('../backend/config/db');

const BASE_URL = process.env.APP_URL || 'http://localhost:3000';

class SessionClient {
  constructor() {
    this.cookies = new Map();
  }

  updateCookies(res) {
    let raw = [];

    if (typeof res.headers.getSetCookie === 'function') {
      raw = res.headers.getSetCookie();
    } else {
      const h = res.headers.get('set-cookie');
      if (h) raw = [h];
    }

    for (const c of raw) {
      const parts = c.split(';')[0].split('=');

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
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  async fetch(url, options = {}) {
    options.headers = options.headers || {};

    const cookie = this.getCookieHeader();

    if (cookie) {
      options.headers['Cookie'] = cookie;
    }

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
    // 1. Reset Exam 2 window and attempt state for student 3
    console.log('[1] Preparing test exam and database state...');

    const now = new Date();
    const start = new Date(now.getTime() - 10 * 60 * 1000);
    const end = new Date(now.getTime() + 50 * 60 * 1000);

    await pool.query(
      "UPDATE exams SET status = 'published', start_datetime = ?, end_datetime = ?, duration_minutes = 60 WHERE id = 2",
      [start, end]
    );

    await pool.query(
      'DELETE FROM answers WHERE attempt_id IN (SELECT id FROM attempts WHERE student_id = 3 AND exam_id = 2)'
    );

    await pool.query(
      'DELETE FROM attempts WHERE student_id = 3 AND exam_id = 2'
    );

    // 2. Fetch CSRF token and log in
    console.log('[2] Logging in as test student...');

    const csrfRes = await client.fetch(
      `${BASE_URL}/api/auth/csrf-token`
    );

    const csrfData = await csrfRes.json();
    let csrfToken = csrfData.csrfToken;

    const loginRes = await client.fetch(
      `${BASE_URL}/api/auth/login`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({
          email: 'student@test.com',
          password: 'Student@123'
        })
      }
    );

    if (!loginRes.ok) {
      throw new Error(`Login failed: ${loginRes.status}`);
    }

    const csrfRes2 = await client.fetch(
      `${BASE_URL}/api/auth/csrf-token`
    );

    const csrfData2 = await csrfRes2.json();
    csrfToken = csrfData2.csrfToken;

    console.log('[3] Student login successful.');

    // 3. Start exam attempt
    console.log('[4] Starting exam attempt...');

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

    console.log(`[5] Started attempt #${attemptId}`);

    // 4. Send two simultaneous submission requests
    console.log(
      '[6] Sending two simultaneous submission requests...'
    );

    const answers = [
      { questionId: 1, response: 'Option A' },
      { questionId: 2, response: 'True' }
    ];

    const concurrentSubmissions = await Promise.all([
      client.fetch(
        `${BASE_URL}/api/attempt/${attemptId}/submit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken
          },
          body: JSON.stringify({ answers })
        }
      ),

      client.fetch(
        `${BASE_URL}/api/attempt/${attemptId}/submit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken
          },
          body: JSON.stringify({ answers })
        }
      )
    ]);

    const concurrentBodies = await Promise.all(
      concurrentSubmissions.map(res => res.json())
    );

    const successCount = concurrentSubmissions.filter(
      res => res.status === 200
    ).length;

    const conflictCount = concurrentSubmissions.filter(
      res => res.status === 409
    ).length;

    console.log(
      '[7] Concurrent submission response statuses:',
      concurrentSubmissions.map(res => res.status)
    );

    // Exactly one request must succeed and one must be rejected
    if (successCount !== 1 || conflictCount !== 1) {
      throw new Error(
        `Expected exactly one HTTP 200 and one HTTP 409. Got ${successCount} successful and ${conflictCount} conflicting responses.`
      );
    }

    // Verify the rejected request returned the correct error
    const conflictIndex = concurrentSubmissions.findIndex(
      res => res.status === 409
    );

    const conflictData = concurrentBodies[conflictIndex];

    if (conflictData.error?.code !== 'ALREADY_SUBMITTED') {
      throw new Error(
        `Expected ALREADY_SUBMITTED, got ${conflictData.error?.code}`
      );
    }

    console.log(
      '[8] Concurrent submission protection passed: one request succeeded and the duplicate was rejected.'
    );

    // 5. Verify database state
    console.log('[9] Verifying submitted attempt in database...');

    const [attempts] = await pool.query(
      'SELECT status, submitted_at, total_score FROM attempts WHERE id = ?',
      [attemptId]
    );

    if (
      attempts.length === 0 ||
      attempts[0].status !== 'submitted' ||
      !attempts[0].submitted_at
    ) {
      throw new Error(
        `Attempt was not correctly marked submitted: ${JSON.stringify(attempts[0])}`
      );
    }

    const originalScore = attempts[0].total_score;

    console.log(
      '[10] Database confirms submitted status and timestamp:',
      attempts[0].submitted_at
    );

    // 6. Test restarting a submitted exam
    console.log('[11] Testing restart of submitted exam...');

    const startRes2 = await client.fetch(
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

    const startData2 = await startRes2.json();

    console.log(
      '[12] Restart response:',
      startRes2.status,
      startData2.error?.code
    );

    if (
      startRes2.status !== 409 ||
      startData2.error?.code !== 'ALREADY_SUBMITTED'
    ) {
      throw new Error(
        `Expected 409 ALREADY_SUBMITTED on restart, got ${startRes2.status}`
      );
    }

    // 7. Test autosaving a submitted attempt
    console.log('[13] Testing autosave on submitted exam...');

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

    console.log(
      '[14] Autosave response:',
      autosaveRes.status,
      autosaveData.error?.code
    );

    if (
      autosaveRes.status !== 409 ||
      autosaveData.error?.code !== 'ALREADY_SUBMITTED'
    ) {
      throw new Error(
        `Expected 409 ALREADY_SUBMITTED on autosave, got ${autosaveRes.status}`
      );
    }

    // 8. Verify original answers remain unchanged
    console.log('[15] Verifying original answers...');

    const [preservedAnswers] = await pool.query(
      'SELECT question_id, response FROM answers WHERE attempt_id = ? ORDER BY question_id ASC',
      [attemptId]
    );

    console.log(
      '[16] Preserved answers:',
      preservedAnswers
    );

    if (
      preservedAnswers.length !== 2 ||
      preservedAnswers[0].response !== 'Option A' ||
      preservedAnswers[1].response !== 'True'
    ) {
      throw new Error(
        'Original answers were overwritten, deleted, or corrupted!'
      );
    }

    // 9. Verify score was not changed by rejected requests
    const [finalAttempts] = await pool.query(
      'SELECT total_score FROM attempts WHERE id = ?',
      [attemptId]
    );

    if (finalAttempts[0].total_score !== originalScore) {
      throw new Error(
        'Total score changed after rejected duplicate requests!'
      );
    }

    console.log('[17] Original answers and score remain preserved.');

    console.log(
      '\n>>> SUCCESS: OEP-F-015 PASSED! Concurrent duplicate submissions were prevented.\n'
    );

    process.exit(0);

  } catch (err) {
    console.error('\n>>> TEST FAILED:', err.message);
    process.exit(1);
  }
}

run();
