/**
 * Automated Verification Test for OEP-F-016, OEP-F-017, OEP-F-018
 *
 * Traceability:
 * - OEP-F-016 / TC-Grade-01: Auto-Grading for MCQ and True/False
 * - OEP-F-017 / TC-Grade-02: Manual Grading of Short Answer Responses
 * - OEP-F-018 / TC-Grade-03: Result Release by Teacher
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

async function getCsrf(client) {
  const res = await client.fetch(`${BASE_URL}/api/auth/csrf-token`);
  const data = await res.json();
  return data.csrfToken;
}

async function run() {
  console.log('=== Starting Test: OEP-F-016, 017, 018 (Grading & Result Release) ===\n');

  try {
    const teacher = new SessionClient();
    const student = new SessionClient();

    // 1. Setup Test Questions in DB
    // Q1: MCQ single (Option B correct, 2 marks)
    // Q2: TrueFalse (True correct, 2 marks)
    // Q3: ShortAnswer (manual, 5 marks)
    await pool.query('DELETE FROM results_released WHERE exam_id = 2');
    await pool.query('DELETE FROM answers WHERE attempt_id IN (SELECT id FROM attempts WHERE exam_id = 2)');
    await pool.query('DELETE FROM attempts WHERE exam_id = 2');
    await pool.query('DELETE FROM exam_questions WHERE exam_id = 2');

    // Insert questions
    const [q1] = await pool.query(
      `INSERT INTO questions (type, text, options, correct_answer, subject, topic, difficulty, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE text = VALUES(text)`,
      ['MCQ_single', 'What is 2 + 2?', JSON.stringify(['2', '4', '6']), JSON.stringify('4'), 'Math', 'Basics', 'Easy', 2]
    );
    const q1Id = q1.insertId || 1;

    const [q2] = await pool.query(
      `INSERT INTO questions (type, text, options, correct_answer, subject, topic, difficulty, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE text = VALUES(text)`,
      ['TrueFalse', 'The sky is blue.', null, JSON.stringify('True'), 'Science', 'General', 'Easy', 2]
    );
    const q2Id = q2.insertId || 2;

    const [q3] = await pool.query(
      `INSERT INTO questions (type, text, options, correct_answer, subject, topic, difficulty, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE text = VALUES(text)`,
      ['ShortAnswer', 'Explain photosynthesis in one sentence.', null, JSON.stringify(''), 'Biology', 'Plants', 'Medium', 2]
    );
    const q3Id = q3.insertId || 3;

    await pool.query(
      `INSERT INTO exam_questions (exam_id, question_id, marks) VALUES
       (2, ?, 2.00), (2, ?, 2.00), (2, ?, 5.00)`,
      [q1Id, q2Id, q3Id]
    );

    // Ensure Exam 2 is published and open
    const now = new Date();
    const start = new Date(now.getTime() - 10 * 60 * 1000);
    const end = new Date(now.getTime() + 50 * 60 * 1000);
    await pool.query(
      "UPDATE exams SET status = 'published', start_datetime = ?, end_datetime = ?, duration_minutes = 60, created_by = 2 WHERE id = 2",
      [start, end]
    );

    // 2. Student logs in & takes the exam
    let studentCsrf = await getCsrf(student);
    const loginRes = await student.fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': studentCsrf },
      body: JSON.stringify({ email: 'student@test.com', password: 'Student@123' }),
    });
    if (!loginRes.ok) throw new Error(`Student login failed: ${loginRes.status}`);

    studentCsrf = await getCsrf(student);
    const startRes = await student.fetch(`${BASE_URL}/api/attempt/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': studentCsrf },
      body: JSON.stringify({ examId: 2 }),
    });
    const startData = await startRes.json();
    const attemptId = startData.attemptId;
    console.log(`[1] Student started attempt #${attemptId}`);

    // Submit answers:
    // Q1: '4' (Correct -> 2 marks)
    // Q2: 'False' (Incorrect -> 0 marks)
    // Q3: 'Plants convert sunlight into chemical energy.' (ShortAnswer -> pending manual grading)
    const answers = [
      { questionId: q1Id, response: '4' },
      { questionId: q2Id, response: 'False' },
      { questionId: q3Id, response: 'Plants convert sunlight into chemical energy.' },
    ];

    const submitRes = await student.fetch(`${BASE_URL}/api/attempt/${attemptId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': studentCsrf },
      body: JSON.stringify({ answers }),
    });
    if (!submitRes.ok) throw new Error(`Student submit failed: ${submitRes.status}`);
    console.log('[2] Student submitted exam successfully.');

    // Wait 500ms for async autoGrade to complete
    await new Promise((r) => setTimeout(r, 600));

    // 3. Verify OEP-F-016: Auto-grading of MCQ and True/False
    const [dbScores] = await pool.query(
      'SELECT question_id, auto_score, manual_score FROM answers WHERE attempt_id = ? ORDER BY question_id ASC',
      [attemptId]
    );
    console.log('[3] Auto-graded answers in DB:', dbScores);

    const q1Score = dbScores.find((s) => s.question_id === q1Id)?.auto_score;
    const q2Score = dbScores.find((s) => s.question_id === q2Id)?.auto_score;

    if (parseFloat(q1Score) !== 2.00 || parseFloat(q2Score) !== 0.00) {
      throw new Error(`Auto-grading incorrect! Expected Q1=2.00, Q2=0.00; got Q1=${q1Score}, Q2=${q2Score}`);
    }
    console.log('✓ TC-Grade-01 / OEP-F-016: Auto-grading calculated correctly (Q1: 2/2, Q2: 0/2).');

    // 4. Verify OEP-F-018: Student cannot view result before Teacher releases it
    const preResultRes = await student.fetch(`${BASE_URL}/api/grading/results/2`);
    console.log('[4] Student viewing result before release -> status:', preResultRes.status);
    if (preResultRes.status !== 403) {
      throw new Error(`Expected 403 RESULTS_NOT_RELEASED, got ${preResultRes.status}`);
    }
    console.log('✓ TC-Grade-03 / OEP-F-018 (Part 1): Student blocked from viewing unreleased results.');

    // 5. Verify OEP-F-017: Manual grading by Teacher
    let teacherCsrf = await getCsrf(teacher);
    // Update teacher password to Teacher@123 if needed
    const bcrypt = require('bcrypt');
    const teacherHash = await bcrypt.hash('Teacher@123', 12);
    await pool.query('UPDATE users SET password_hash = ? WHERE email = ?', [teacherHash, 'teacher@test.com']);

    const teacherLogin = await teacher.fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': teacherCsrf },
      body: JSON.stringify({ email: 'teacher@test.com', password: 'Teacher@123' }),
    });
    if (!teacherLogin.ok) throw new Error(`Teacher login failed: ${teacherLogin.status}`);
    console.log('[5] Teacher logged in successfully.');

    teacherCsrf = await getCsrf(teacher);
    // Teacher fetches attempt for grading
    const attemptGradingRes = await teacher.fetch(`${BASE_URL}/api/grading/${attemptId}`);
    const attemptGradingData = await attemptGradingRes.json();
    if (!attemptGradingRes.ok) throw new Error(`Fetch attempt for grading failed: ${attemptGradingRes.status}`);
    console.log('[6] Teacher retrieved attempt answers for grading.');

    // Teacher grades Short Answer (Q3) giving 4.5 out of 5
    const q3AnswerId = dbScores.find((s) => s.question_id === q3Id)?.id || (await pool.query('SELECT id FROM answers WHERE attempt_id = ? AND question_id = ?', [attemptId, q3Id]))[0][0].id;
    const saveScoreRes = await teacher.fetch(`${BASE_URL}/api/grading/${attemptId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': teacherCsrf },
      body: JSON.stringify({
        scores: [{ answerId: q3AnswerId, score: 4.5 }],
      }),
    });
    const saveScoreData = await saveScoreRes.json();
    if (!saveScoreRes.ok) throw new Error(`Save manual scores failed: ${JSON.stringify(saveScoreData)}`);
    console.log('[7] Teacher saved manual score 4.5/5. Total score now:', saveScoreData.totalScore);

    // Verify total score in DB = 2.0 (MCQ) + 0.0 (TF) + 4.5 (ShortAnswer) = 6.5
    const [att] = await pool.query('SELECT total_score FROM attempts WHERE id = ?', [attemptId]);
    if (parseFloat(att[0].total_score) !== 6.5) {
      throw new Error(`Total score mismatch! Expected 6.5, got ${att[0].total_score}`);
    }
    console.log('✓ TC-Grade-02 / OEP-F-017: Manual grading saved and total score recalculated to 6.5.');

    // 6. Verify OEP-F-018: Teacher releases results
    const releaseRes = await teacher.fetch(`${BASE_URL}/api/grading/2/release`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': teacherCsrf },
    });
    if (!releaseRes.ok) throw new Error(`Release results failed: ${releaseRes.status}`);
    console.log('[8] Teacher released results to students.');

    // 7. Verify Student can now view result
    const postResultRes = await student.fetch(`${BASE_URL}/api/grading/results/2`);
    const postResultData = await postResultRes.json();
    if (!postResultRes.ok) throw new Error(`Student get result failed after release: ${postResultRes.status}`);
    console.log('[9] Student viewed released result:', postResultData.result);

    if (parseFloat(postResultData.result.total_score) !== 6.5) {
      throw new Error(`Student result total score expected 6.5, got ${postResultData.result.total_score}`);
    }
    console.log('✓ TC-Grade-03 / OEP-F-018 (Part 2): Student successfully viewed result with total score 6.5 / 9.0.');

    console.log('\n>>> SUCCESS: TC-Grade-01, TC-Grade-02, TC-Grade-03 / OEP-F-016, 017, 018 ALL PASSED!\n');
    process.exit(0);
  } catch (err) {
    console.error('\n>>> TEST FAILED:', err.message);
    process.exit(1);
  }
}

run();
