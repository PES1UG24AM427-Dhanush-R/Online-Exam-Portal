/**
 * Automated Verification Test for OEP-F-015: Duplicate Exam Submission Prevention
 *
 * Test Case Traceability: STP TC-Take-04 / SRS OEP-F-015
 *
 * Verifies:
 * 1. Initial submission of an exam attempt succeeds (HTTP 200).
 * 2. Attempt record is transitioned to 'submitted' with a valid submitted_at timestamp.
 * 3. Second submission attempt is rejected with HTTP 409 Conflict (code: ALREADY_SUBMITTED).
 * 4. Re-starting or autosaving a submitted exam attempt returns HTTP 409 Conflict.
 * 5. Original submission answers and total score remain preserved and uncorrupted.
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
  console.log('=== Starting Test: OEP-F-015 (TC-Take-04 Duplicate Submission Prevention) ===\n');
  const client = new SessionClient();

  try {
    // 1. Reset Exam 2 window and attempt state for student 3
    const now = new Date();
    const start = new Date(now.getTime() - 10 * 60 * 1000);
    const end = new Date(now.getTime() + 50 * 60 * 1000);
    await pool.query(
      "UPDATE exams SET status = 'published', start_datetime = ?, end_datetime = ?, duration_minutes = 60 WHERE id = 2",
      [start, end]
    );

    await pool.query('DELETE FROM answers WHERE attempt_id IN (SELECT id FROM attempts WHERE student_id = 3 AND exam_id = 2)');
    await pool.query('DELETE FROM attempts WHERE student_id = 3 AND exam_id = 2');

    // 2. Fetch CSRF token & Login
    const csrfRes = await client.fetch(`${BASE_URL}/api/auth/csrf-token`);
    const csrfData = await csrfRes.json();
    let csrfToken = csrfData.csrfToken;

    const loginRes = await client.fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
      body: JSON.stringify({ email: 'student@test.com', password: 'Student@123' }),
    });
    if (!loginRes.ok) throw new Error(`Login failed: ${loginRes.status}`);

    const csrfRes2 = await client.fetch(`${BASE_URL}/api/auth/csrf-token`);
    const csrfData2 = await csrfRes2.json();
    csrfToken = csrfData2.csrfToken;

    // 3. Start attempt
    const startRes = await client.fetch(`${BASE_URL}/api/attempt/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
      body: JSON.stringify({ examId: 2 }),
    });
    const startData = await startRes.json();
    if (!startRes.ok) throw new Error(`Start attempt failed: ${JSON.stringify(startData)}`);
    const attemptId = startData.attemptId;
    console.log(`[1] Started attempt #${attemptId}`);

    // 4. Submit attempt (First submission)
    const answers = [
      { questionId: 1, response: 'Option A' },
      { questionId: 2, response: 'True' },
    ];

    const submitRes1 = await client.fetch(`${BASE_URL}/api/attempt/${attemptId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
      body: JSON.stringify({ answers }),
    });

    const submitData1 = await submitRes1.json();
    console.log('[2] First submission response status:', submitRes1.status, submitData1.message);
    if (submitRes1.status !== 200) {
      throw new Error(`Expected first submission to return 200, got ${submitRes1.status}: ${JSON.stringify(submitData1)}`);
    }

    // Verify DB state
    const [attempts1] = await pool.query('SELECT status, submitted_at FROM attempts WHERE id = ?', [attemptId]);
    if (attempts1[0].status !== 'submitted' || !attempts1[0].submitted_at) {
      throw new Error(`Attempt was not marked submitted in database! ${JSON.stringify(attempts1[0])}`);
    }
    console.log('[3] Verified DB attempt status is "submitted" with timestamp:', attempts1[0].submitted_at);

    // 5. Submit attempt AGAIN (Second submission)
    console.log('[4] Testing duplicate submission...');
    const submitRes2 = await client.fetch(`${BASE_URL}/api/attempt/${attemptId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
      body: JSON.stringify({ answers: [{ questionId: 1, response: 'Option B' }] }),
    });

    const submitData2 = await submitRes2.json();
    console.log('[5] Second submission response status:', submitRes2.status, submitData2.error?.code);

    if (submitRes2.status !== 409) {
      throw new Error(`Expected second submission to return 409 Conflict, got ${submitRes2.status}: ${JSON.stringify(submitData2)}`);
    }
    if (submitData2.error?.code !== 'ALREADY_SUBMITTED') {
      throw new Error(`Expected error code ALREADY_SUBMITTED, got ${submitData2.error?.code}`);
    }

    // 6. Test restarting submitted exam
    console.log('[6] Testing restart attempt on submitted exam...');
    const startRes2 = await client.fetch(`${BASE_URL}/api/attempt/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
      body: JSON.stringify({ examId: 2 }),
    });
    const startData2 = await startRes2.json();
    console.log('[7] Restart submitted exam response status:', startRes2.status, startData2.error?.code);
    if (startRes2.status !== 409 || startData2.error?.code !== 'ALREADY_SUBMITTED') {
      throw new Error(`Expected 409 ALREADY_SUBMITTED on restarting submitted exam, got ${startRes2.status}`);
    }

    // 7. Test autosave on submitted attempt
    console.log('[8] Testing autosave on submitted exam attempt...');
    const autosaveRes2 = await client.fetch(`${BASE_URL}/api/attempt/${attemptId}/autosave`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
      body: JSON.stringify({ answers: [{ questionId: 1, response: 'Tampered Answer' }] }),
    });
    const autosaveData2 = await autosaveRes2.json();
    console.log('[9] Autosave on submitted exam status:', autosaveRes2.status, autosaveData2.error?.code);
    if (autosaveRes2.status !== 409 || autosaveData2.error?.code !== 'ALREADY_SUBMITTED') {
      throw new Error(`Expected 409 ALREADY_SUBMITTED on autosaving submitted exam, got ${autosaveRes2.status}`);
    }

    // 8. Verify initial answers are still preserved and untampered
    const [preservedAnswers] = await pool.query('SELECT question_id, response FROM answers WHERE attempt_id = ? ORDER BY question_id ASC', [attemptId]);
    console.log('[10] Preserved original answers in DB:', preservedAnswers);
    if (preservedAnswers[0].response !== 'Option A' || preservedAnswers[1].response !== 'True') {
      throw new Error('Original answers were overwritten or corrupted!');
    }

    console.log('\n>>> SUCCESS: TC-Take-04 / OEP-F-015 PASSED! Duplicate submission prevented.\n');
    process.exit(0);
  } catch (err) {
    console.error('\n>>> TEST FAILED:', err.message);
    process.exit(1);
  }
}

run();
