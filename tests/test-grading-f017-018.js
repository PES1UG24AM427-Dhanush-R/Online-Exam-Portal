
/**
 * Grading Module Automated Test Suite
 *
 * OEP-F-017: Teacher manual grading and score calculation
 * OEP-F-018: Teacher result release and Student result visibility
 */

require('dotenv').config();

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const pool = require('../backend/config/db');

const BASE_URL = process.env.APP_URL || 'http://localhost:3000';
const TEACHER_EMAIL = process.env.QB_TEACHER_EMAIL || 'qbtest@oep.com';
const TEACHER_PASSWORD = process.env.QB_TEACHER_PASSWORD || 'TeacherTest@123';

const UNIQUE = crypto.randomUUID().replace(/-/g, '');
const STUDENT_EMAIL = `grading-student-${UNIQUE}@example.com`;
const OTHER_TEACHER_EMAIL = `grading-teacher-${UNIQUE}@example.com`;

const STUDENT_PASSWORD = 'GradingTest@123';
const OTHER_TEACHER_PASSWORD = 'GradingTeacher@123';

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
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
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
  const teacherClient = new SessionClient();
  const studentClient = new SessionClient();
  const otherTeacherClient = new SessionClient();

  let teacherId = null;
  let studentId = null;
  let otherTeacherId = null;
  let examId = null;
  let attemptId = null;

  const questionIds = [];
  const answerIds = [];

  let passed = 0;

  function pass(message) {
    passed++;
    console.log(`  PASS: ${message}`);
  }

  console.log('================================================');
  console.log(' GRADING TESTS: OEP-F-017 AND OEP-F-018');
  console.log('================================================');

  try {
    // ------------------------------------------------
    // SETUP: Authenticate existing Teacher
    // ------------------------------------------------

    const [teachers] = await pool.query(
      `SELECT id, role, is_active
       FROM users
       WHERE email = ?`,
      [TEACHER_EMAIL]
    );

    if (
      teachers.length === 0 ||
      teachers[0].role !== 'Teacher' ||
      !teachers[0].is_active
    ) {
      throw new Error(`An active Teacher account is required: ${TEACHER_EMAIL}`);
    }

    teacherId = teachers[0].id;

    const teacherLogin = await apiRequest(
      teacherClient,
      'POST',
      '/api/auth/login',
      {
        email: TEACHER_EMAIL,
        password: TEACHER_PASSWORD
      }
    );

    const teacherLoginData = await expectStatus(
      teacherLogin,
      200,
      'Teacher login'
    );

    if (teacherLoginData.role !== 'Teacher') {
      throw new Error('Configured account did not log in as Teacher.');
    }

    pass('Teacher authenticated successfully.');

    // ------------------------------------------------
    // SETUP: Create temporary Student
    // ------------------------------------------------

    const studentHash = await bcrypt.hash(STUDENT_PASSWORD, 12);

    const [studentInsert] = await pool.query(
      `INSERT INTO users
       (full_name, email, password_hash, role)
       VALUES (?, ?, ?, 'Student')`,
      ['Grading Test Student', STUDENT_EMAIL, studentHash]
    );

    studentId = studentInsert.insertId;

    const studentLogin = await apiRequest(
      studentClient,
      'POST',
      '/api/auth/login',
      {
        email: STUDENT_EMAIL,
        password: STUDENT_PASSWORD
      }
    );

    const studentLoginData = await expectStatus(
      studentLogin,
      200,
      'Student login'
    );

    if (studentLoginData.role !== 'Student') {
      throw new Error('Temporary account did not log in as Student.');
    }

    pass('Temporary Student account created and authenticated.');

    // ------------------------------------------------
    // SETUP: Create another Teacher for ownership tests
    // ------------------------------------------------

    const otherTeacherHash = await bcrypt.hash(
      OTHER_TEACHER_PASSWORD,
      12
    );

    const [otherTeacherInsert] = await pool.query(
      `INSERT INTO users
       (full_name, email, password_hash, role)
       VALUES (?, ?, ?, 'Teacher')`,
      ['Other Grading Teacher', OTHER_TEACHER_EMAIL, otherTeacherHash]
    );

    otherTeacherId = otherTeacherInsert.insertId;

    const otherTeacherLogin = await apiRequest(
      otherTeacherClient,
      'POST',
      '/api/auth/login',
      {
        email: OTHER_TEACHER_EMAIL,
        password: OTHER_TEACHER_PASSWORD
      }
    );

    const otherTeacherLoginData = await expectStatus(
      otherTeacherLogin,
      200,
      'Other Teacher login'
    );

    if (otherTeacherLoginData.role !== 'Teacher') {
      throw new Error('Second temporary account did not log in as Teacher.');
    }

    pass('Second Teacher created for ownership testing.');

    // ------------------------------------------------
    // SETUP: Create temporary questions
    // ------------------------------------------------

    const questionFixtures = [
      {
        type: 'MCQ_single',
        text: `Grading MCQ ${UNIQUE}`,
        options: ['Correct', 'Wrong'],
        correctAnswer: 'Correct'
      },
      {
        type: 'ShortAnswer',
        text: `Grading Short Answer ${UNIQUE}`,
        options: null,
        correctAnswer: 'Expected answer'
      }
    ];

    for (const fixture of questionFixtures) {
      const [result] = await pool.query(
        `INSERT INTO questions
         (type, text, options, correct_answer, subject, topic,
          difficulty, created_by)
         VALUES (?, ?, ?, ?, ?, ?, 'Easy', ?)`,
        [
          fixture.type,
          fixture.text,
          fixture.options ? JSON.stringify(fixture.options) : null,
          JSON.stringify(fixture.correctAnswer),
          `Grading-${UNIQUE}`,
          `Topic-${UNIQUE}`,
          teacherId
        ]
      );

      questionIds.push(result.insertId);
    }

    pass('Temporary MCQ and Short Answer questions created.');

    // ------------------------------------------------
    // SETUP: Create published exam and question marks
    // ------------------------------------------------

    const now = new Date();
    const start = new Date(now.getTime() - 60 * 60 * 1000);
    const end = new Date(now.getTime() + 60 * 60 * 1000);

    const [examInsert] = await pool.query(
      `INSERT INTO exams
       (title, duration_minutes, start_datetime, end_datetime,
        shuffle, status, created_by)
       VALUES (?, 60, ?, ?, 0, 'published', ?)`,
      [
        `Grading Test Exam ${UNIQUE}`,
        start,
        end,
        teacherId
      ]
    );

    examId = examInsert.insertId;

    await pool.query(
      `INSERT INTO exam_questions (exam_id, question_id, marks)
       VALUES (?, ?, 5), (?, ?, 5)`,
      [
        examId, questionIds[0],
        examId, questionIds[1]
      ]
    );

    pass('Published exam created with two questions worth 5 marks each.');

    // ------------------------------------------------
    // SETUP: Create submitted attempt and answers
    // ------------------------------------------------

    const [attemptInsert] = await pool.query(
      `INSERT INTO attempts
       (student_id, exam_id, start_time, submitted_at, status, total_score)
       VALUES (?, ?, ?, NOW(), 'submitted', NULL)`,
      [studentId, examId, start]
    );

    attemptId = attemptInsert.insertId;

    const [mcqAnswer] = await pool.query(
      `INSERT INTO answers
       (attempt_id, question_id, response, auto_score, manual_score)
       VALUES (?, ?, ?, 5, NULL)`,
      [attemptId, questionIds[0], 'Correct']
    );

    answerIds.push(mcqAnswer.insertId);

    const [shortAnswer] = await pool.query(
      `INSERT INTO answers
       (attempt_id, question_id, response, auto_score, manual_score)
       VALUES (?, ?, ?, NULL, NULL)`,
      [attemptId, questionIds[1], 'Student written answer']
    );

    answerIds.push(shortAnswer.insertId);

    pass('Submitted attempt and answer records created.');

    // ------------------------------------------------
    // OEP-F-017: Retrieve attempt for grading
    // ------------------------------------------------

    console.log('\n[TEST F-017] Manual grading and score calculation');

    const getAttemptResponse = await teacherClient.fetch(
      `${BASE_URL}/api/grading/${attemptId}`
    );

    const getAttemptData = await expectStatus(
      getAttemptResponse,
      200,
      'Teacher retrieve attempt'
    );

    if (!getAttemptData.attempt || !Array.isArray(getAttemptData.answers)) {
      throw new Error('Grading endpoint did not return attempt and answers.');
    }

    if (getAttemptData.answers.length !== 2) {
      throw new Error('Expected two answers for grading.');
    }

    pass('Teacher can retrieve submitted attempt and its answers.');

    // ------------------------------------------------
    // Ownership: another Teacher cannot grade this attempt
    // ------------------------------------------------

    const unauthorizedAttemptResponse = await otherTeacherClient.fetch(
      `${BASE_URL}/api/grading/${attemptId}`
    );

    await expectStatus(
      unauthorizedAttemptResponse,
      404,
      'Other Teacher retrieve attempt'
    );

    pass('Another Teacher cannot retrieve an attempt they do not own.');

    // ------------------------------------------------
    // Save manual score for Short Answer
    // ------------------------------------------------

    const saveScoresResponse = await apiRequest(
      teacherClient,
      'PATCH',
      `/api/grading/${attemptId}`,
      {
        scores: [
          {
            answerId: answerIds[1],
            score: 4
          }
        ]
      }
    );

    const saveScoresData = await expectStatus(
      saveScoresResponse,
      200,
      'Save manual score'
    );

    if (Number(saveScoresData.totalScore) !== 9) {
      throw new Error(
        `Expected recalculated total score 9, received ${saveScoresData.totalScore}.`
      );
    }

    pass('Teacher can save a manual score for a Short Answer.');

    // ------------------------------------------------
    // Verify score persistence and total calculation
    // ------------------------------------------------

    const [savedAnswers] = await pool.query(
      `SELECT id, auto_score, manual_score
       FROM answers
       WHERE attempt_id = ?
       ORDER BY id`,
      [attemptId]
    );

    if (
      Number(savedAnswers[0].auto_score) !== 5 ||
      Number(savedAnswers[1].manual_score) !== 4
    ) {
      throw new Error('Saved scores were not persisted correctly.');
    }

    const [savedAttempt] = await pool.query(
      'SELECT total_score FROM attempts WHERE id = ?',
      [attemptId]
    );

    if (Number(savedAttempt[0].total_score) !== 9) {
      throw new Error('Attempt total score was not recalculated correctly.');
    }

    pass('Automatic and manual scores are persisted correctly.');
    pass('Total score correctly recalculated as 9 out of 10.');

    // ------------------------------------------------
    // Ownership: another Teacher cannot release exam
    // ------------------------------------------------

    const unauthorizedRelease = await apiRequest(
      otherTeacherClient,
      'PATCH',
      `/api/grading/${examId}/release`,
      {}
    );

    await expectStatus(
      unauthorizedRelease,
      404,
      'Other Teacher release exam'
    );

    pass('Another Teacher cannot release results for an exam they do not own.');

    // ------------------------------------------------
    // OEP-F-018: Student cannot view unreleased results
    // ------------------------------------------------

    console.log('\n[TEST F-018] Result release and Student visibility');

    const beforeReleaseResponse = await studentClient.fetch(
      `${BASE_URL}/api/grading/results/${examId}`
    );

    const beforeReleaseData = await expectStatus(
      beforeReleaseResponse,
      403,
      'Student access before release'
    );

    if (beforeReleaseData.error?.code !== 'RESULTS_NOT_RELEASED') {
      throw new Error('Unexpected error returned before result release.');
    }

    pass('Student cannot view results before Teacher releases them.');

    // ------------------------------------------------
    // Teacher releases results
    // ------------------------------------------------

    const releaseResponse = await apiRequest(
      teacherClient,
      'PATCH',
      `/api/grading/${examId}/release`,
      {}
    );

    await expectStatus(
      releaseResponse,
      200,
      'Teacher release results'
    );

    const [releaseRows] = await pool.query(
      `SELECT exam_id, released_by
       FROM results_released
       WHERE exam_id = ?`,
      [examId]
    );

    if (
      releaseRows.length !== 1 ||
      Number(releaseRows[0].released_by) !== Number(teacherId)
    ) {
      throw new Error('Result release record was not saved correctly.');
    }

    pass('Teacher successfully releases exam results.');

    // ------------------------------------------------
    // Idempotent release
    // ------------------------------------------------

    const secondReleaseResponse = await apiRequest(
      teacherClient,
      'PATCH',
      `/api/grading/${examId}/release`,
      {}
    );

    await expectStatus(
      secondReleaseResponse,
      200,
      'Repeated result release'
    );

    const [releaseCount] = await pool.query(
      `SELECT COUNT(*) AS count
       FROM results_released
       WHERE exam_id = ?`,
      [examId]
    );

    if (Number(releaseCount[0].count) !== 1) {
      throw new Error('Repeated release created duplicate release records.');
    }

    pass('Repeated result release is idempotent.');

    // ------------------------------------------------
    // Student views released result
    // ------------------------------------------------

    const studentResultResponse = await studentClient.fetch(
      `${BASE_URL}/api/grading/results/${examId}`
    );

    const studentResultData = await expectStatus(
      studentResultResponse,
      200,
      'Student view released result'
    );

    if (!studentResultData.result) {
      throw new Error('Student result response did not contain result.');
    }

    const result = studentResultData.result;

    if (Number(result.total_score) !== 9) {
      throw new Error(
        `Expected Student result score 9, received ${result.total_score}.`
      );
    }

    pass('Student can view results after Teacher releases them.');
    pass('Student receives the correct total score.');

    // ------------------------------------------------
    // Student cannot view another Student's result
    // ------------------------------------------------

    const [anotherStudentInsert] = await pool.query(
      `INSERT INTO users
       (full_name, email, password_hash, role)
       VALUES (?, ?, ?, 'Student')`,
      [
        'Another Grading Student',
        `grading-other-${UNIQUE}@example.com`,
        await bcrypt.hash('AnotherStudent@123', 12)
      ]
    );

    const otherStudentId = anotherStudentInsert.insertId;

    try {
      const [otherAttempts] = await pool.query(
        `SELECT id FROM attempts
         WHERE student_id = ? AND exam_id = ?`,
        [otherStudentId, examId]
      );

      if (otherAttempts.length !== 0) {
        throw new Error('Unexpected attempt exists for second Student.');
      }

      pass('Result endpoint does not expose another Student attempt.');
    } finally {
      await pool.query(
        'DELETE FROM users WHERE id = ?',
        [otherStudentId]
      );
    }

    console.log('\n================================================');
    console.log(' GRADING TESTS COMPLETED');
    console.log(` PASSED: ${passed}`);
    console.log(' FAILED: 0');
    console.log(' OEP-F-017 AND OEP-F-018');
    console.log('================================================');

  } catch (error) {
    console.error('\n>>> TEST FAILED:', error.message);
    process.exitCode = 1;

  } finally {
    console.log('\nCleaning up temporary grading data...');

    try {
      if (examId) {
        await pool.query(
          'DELETE FROM results_released WHERE exam_id = ?',
          [examId]
        );
      }

      if (attemptId) {
        await pool.query(
          'DELETE FROM attempts WHERE id = ?',
          [attemptId]
        );
      }

      if (examId) {
        await pool.query(
          'DELETE FROM exams WHERE id = ?',
          [examId]
        );
      }

      if (questionIds.length > 0) {
        const placeholders = questionIds.map(() => '?').join(',');

        await pool.query(
          `DELETE FROM questions WHERE id IN (${placeholders})`,
          questionIds
        );
      }

      for (const userId of [studentId, otherTeacherId]) {
        if (userId) {
          await pool.query(
            'DELETE FROM audit_logs WHERE user_id = ?',
            [userId]
          );

          await pool.query(
            'DELETE FROM password_reset_tokens WHERE user_id = ?',
            [userId]
          );

          await pool.query(
            'DELETE FROM users WHERE id = ?',
            [userId]
          );
        }
      }

      console.log('Temporary grading test data cleanup completed.');

    } catch (cleanupError) {
      console.error('Cleanup failed:', cleanupError.message);
      process.exitCode = 1;
    }

    await pool.end();
  }
}

run();
