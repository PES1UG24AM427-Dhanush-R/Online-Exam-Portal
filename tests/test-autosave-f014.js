/**
 * Automated Verification Test for OEP-F-014: Auto-Save Answers Every 60 Seconds
 *
 * Test Case Traceability: STP TC-Take-03 / SRS OEP-F-014
 *
 * Verifies:
 * 1. Student answers can be auto-saved via POST /api/attempt/:id/autosave.
 * 2. Database records the upserted answers.
 * 3. On reconnect (calling POST /api/attempt/start), saved answers are restored.
 * 4. Timer does not reset upon reconnect (server-authoritative remaining time).
 */

require('dotenv').config();
const pool = require('../backend/config/db');

const BASE_URL = process.env.APP_URL || 'http://localhost:3000';

class SessionClient {
  constructor() {
    this.cookies = new Map();
  }

  updateCookies(res) {
    // node-fetch / global fetch headers.getSetCookie() or get('set-cookie')
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
        this.cookies.set(parts[0].trim(), parts.slice(1).join('=').trim());
      }
    }
  }

  getCookieHeader() {
    return Array.from(this.cookies.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
  }

  async fetch(url, options = {}) {
    options.headers = options.headers || {};
    const cookie = this.getCookieHeader();
    if (cookie) options.headers['Cookie'] = cookie;
    const res = await fetch(url, options);
    this.updateCookies(res);
    return res;
  }
}

async function run() {
  console.log('=== Starting Test: OEP-F-014 (TC-Take-03 Auto-Save & Restoration) ===\n');
  const client = new SessionClient();

  try {
    // 1. Ensure Exam 2 is published and open
    const now = new Date();
    const start = new Date(now.getTime() - 15 * 60 * 1000); // 15 mins ago
    const end = new Date(now.getTime() + 45 * 60 * 1000);   // 45 mins in future
    await pool.query(
      "UPDATE exams SET status = 'published', start_datetime = ?, end_datetime = ?, duration_minutes = 60 WHERE id = 2",
      [start, end]
    );

    // Make sure questions are linked to exam 2
    const [eq] = await pool.query('SELECT * FROM exam_questions WHERE exam_id = 2');
    if (eq.length === 0) {
      await pool.query('INSERT IGNORE INTO exam_questions (exam_id, question_id, marks) VALUES (2, 1, 2.00), (2, 2, 2.00)');
    }

    // Reset attempt for student 3 on exam 2 to a clean in-progress state
    await pool.query('DELETE FROM answers WHERE attempt_id IN (SELECT id FROM attempts WHERE student_id = 3 AND exam_id = 2)');
    await pool.query('DELETE FROM attempts WHERE student_id = 3 AND exam_id = 2');

    // 2. Fetch initial CSRF token
    const csrfRes = await client.fetch(`${BASE_URL}/api/auth/csrf-token`);
    const csrfData = await csrfRes.json();
    let csrfToken = csrfData.csrfToken;
    console.log('[1] Fetch CSRF token: OK');

    // 3. Login as student (student@test.com)
    const loginRes = await client.fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      body: JSON.stringify({ email: 'student@test.com', password: 'Student@123' }),
    });

    if (!loginRes.ok) {
      const err = await loginRes.json();
      throw new Error(`Login failed with status ${loginRes.status}: ${JSON.stringify(err)}`);
    }
    console.log('[2] Student login: OK');

    // Fetch refreshed CSRF token if needed
    const csrfRes2 = await client.fetch(`${BASE_URL}/api/auth/csrf-token`);
    const csrfData2 = await csrfRes2.json();
    csrfToken = csrfData2.csrfToken;

    // 4. Start attempt
    const startRes = await client.fetch(`${BASE_URL}/api/attempt/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      body: JSON.stringify({ examId: 2 }),
    });

    const startData = await startRes.json();
    if (!startRes.ok) throw new Error(`Start attempt failed: ${JSON.stringify(startData)}`);
    const attemptId = startData.attemptId;
    console.log(`[3] Started attempt #${attemptId}, duration: ${startData.durationSeconds}s, remaining: ${startData.remainingSeconds}s`);

    // 5. Test Auto-save
    const answersToSave = [
      { questionId: 1, response: 'Option A' },
      { questionId: 2, response: 'True' },
    ];

    const autosaveRes = await client.fetch(`${BASE_URL}/api/attempt/${attemptId}/autosave`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      body: JSON.stringify({ answers: answersToSave }),
    });

    const autosaveData = await autosaveRes.json();
    if (!autosaveRes.ok) throw new Error(`Autosave failed: ${JSON.stringify(autosaveData)}`);
    console.log('[4] Auto-save request succeeded:', autosaveData.message, 'savedAt:', autosaveData.savedAt);

    // 6. Verify database answers
    const [dbAnswers] = await pool.query('SELECT question_id, response FROM answers WHERE attempt_id = ? ORDER BY question_id ASC', [attemptId]);
    console.log('[5] Database answers verified:', dbAnswers);
    if (dbAnswers.length !== 2) throw new Error('Expected 2 answers in database!');

    // 7. Simulate Disconnect & Reconnect (re-opening the exam)
    console.log('[6] Simulating reconnect to ongoing exam...');
    const reconnectRes = await client.fetch(`${BASE_URL}/api/attempt/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      body: JSON.stringify({ examId: 2 }),
    });

    const reconnectData = await reconnectRes.json();
    if (!reconnectRes.ok) throw new Error(`Reconnect failed: ${JSON.stringify(reconnectData)}`);

    console.log('[7] Reconnect response received:');
    console.log('    Saved answers restored:', reconnectData.savedAnswers);
    console.log(`    Remaining seconds: ${reconnectData.remainingSeconds}s (original: ${startData.remainingSeconds}s)`);

    // Check restored answers match
    const restoredMap = {};
    reconnectData.savedAnswers.forEach((a) => { restoredMap[a.questionId] = a.response; });

    if (restoredMap[1] !== 'Option A' || restoredMap[2] !== 'True') {
      throw new Error(`Restored answers do not match! Expected Option A and True, got: ${JSON.stringify(restoredMap)}`);
    }

    // Check timer was not reset
    if (reconnectData.remainingSeconds > startData.remainingSeconds) {
      throw new Error(`Timer reset detected! remainingSeconds (${reconnectData.remainingSeconds}) > startData (${startData.remainingSeconds})`);
    }

    console.log('\n>>> SUCCESS: TC-Take-03 / OEP-F-014 PASSED! Auto-save and restoration verified.\n');
    process.exit(0);
  } catch (err) {
    console.error('\n>>> TEST FAILED:', err.message);
    process.exit(1);
  }
}

run();
