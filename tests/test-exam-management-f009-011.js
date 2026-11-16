
/**
 * Exam Management Automated Test Suite
 *
 * OEP-F-009: Exam creation and question mark allocation
 * OEP-F-010: Exam settings and draft configuration
 * OEP-F-011: Exam publishing and Student visibility
 *
 * Teacher credentials:
 * QB_TEACHER_EMAIL
 * QB_TEACHER_PASSWORD
 */

require('dotenv').config();

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const pool = require('../backend/config/db');

const BASE_URL = process.env.APP_URL || 'http://localhost:3000';
const TEACHER_EMAIL = process.env.QB_TEACHER_EMAIL || 'qbtest@oep.com';
const TEACHER_PASSWORD = process.env.QB_TEACHER_PASSWORD || 'TeacherTest@123';

const UNIQUE = crypto.randomUUID().replace(/-/g, '');
const STUDENT_EMAIL = `exam-test-${UNIQUE}@example.com`;
const STUDENT_PASSWORD = 'ExamTest@123';

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
    throw new Error(
      `Expected JSON response. Received: ${text.slice(0, 300)}`
    );
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

function makeQuestionPayload(suffix) {
  return {
    type: 'MCQ_single',
    text: `Exam Management Test Question ${suffix} ${UNIQUE}`,
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
    correctAnswer: 'Option A',
    subject: `ExamTest-${UNIQUE}`,
    topic: `Topic-${UNIQUE}`,
    difficulty: 'Easy'
  };
}

function examPayload(questionIds, suffix = '') {
  const start = new Date(Date.now() + 60 * 60 * 1000);
  const end = new Date(Date.now() + 3 * 60 * 60 * 1000);

  return {
    title: `Exam Management Test ${UNIQUE} ${suffix}`,
    durationMinutes: 60,
    startDatetime: start.toISOString(),
    endDatetime: end.toISOString(),
    shuffle: true,
    questions: [
      { questionId: questionIds[0], marks: 5 },
      { questionId: questionIds[1], marks: 10 }
    ]
  };
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

  let teacherId = null;
  let studentId = null;

  const questionIds = [];
  const examIds = [];

  let passed = 0;
  let skipped = 0;

  function pass(message) {
    passed++;
    console.log(`  PASS: ${message}`);
  }

  function skip(message) {
    skipped++;
    console.log(`  SKIP: ${message}`);
  }

  console.log('================================================');
  console.log(' EXAM MANAGEMENT TESTS: OEP-F-009 TO F-011');
  console.log('================================================');

  try {
    // ------------------------------------------------
    // SETUP: Verify Teacher account
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
      throw new Error(
        `An active Teacher account is required: ${TEACHER_EMAIL}`
      );
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

    pass('Teacher authentication successful.');

    // ------------------------------------------------
    // SETUP: Create temporary Student account
    // ------------------------------------------------

    const passwordHash = await bcrypt.hash(STUDENT_PASSWORD, 12);

    const [studentInsert] = await pool.query(
      `INSERT INTO users
       (full_name, email, password_hash, role)
       VALUES (?, ?, ?, 'Student')`,
      [
        'Exam Management Test Student',
        STUDENT_EMAIL,
        passwordHash
      ]
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
    // SETUP: Create temporary questions
    // ------------------------------------------------

    for (let i = 1; i <= 3; i++) {
      const payload = makeQuestionPayload(i);

      const [result] = await pool.query(
        `INSERT INTO questions
         (type, text, options, correct_answer, subject, topic,
          difficulty, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          payload.type,
          payload.text,
          JSON.stringify(payload.options),
          JSON.stringify(payload.correctAnswer),
          payload.subject,
          payload.topic,
          payload.difficulty,
          teacherId
        ]
      );

      questionIds.push(result.insertId);
    }

    pass('Three temporary Teacher-owned questions created.');

    // ------------------------------------------------
    // OEP-F-009: Create exam and allocate marks
    // ------------------------------------------------

    console.log('\n[TEST F-009] Exam creation and mark allocation');

    const createPayload = examPayload(questionIds, 'CREATE');

    const createResponse = await apiRequest(
      teacherClient,
      'POST',
      '/api/exams',
      createPayload
    );

    const createData = await expectStatus(
      createResponse,
      201,
      'Exam creation'
    );

    if (!createData.examId) {
      throw new Error('Exam creation did not return an examId.');
    }

    const examId = createData.examId;
    examIds.push(examId);

    pass('Teacher successfully created an exam.');

    const [examRows] = await pool.query(
      `SELECT id, title, duration_minutes, start_datetime,
              end_datetime, shuffle, status, created_by
       FROM exams WHERE id = ?`,
      [examId]
    );

    if (examRows.length !== 1) {
      throw new Error('Created exam was not found in the database.');
    }

    const createdExam = examRows[0];

    if (createdExam.status !== 'draft') {
      throw new Error('Newly created exam should have draft status.');
    }

    if (Number(createdExam.created_by) !== Number(teacherId)) {
      throw new Error('Exam ownership was not saved correctly.');
    }

    pass('New exam saved with draft status and correct ownership.');

    const [allocationRows] = await pool.query(
      `SELECT question_id, marks
       FROM exam_questions
       WHERE exam_id = ?
       ORDER BY question_id`,
      [examId]
    );

    if (allocationRows.length !== 2) {
      throw new Error('Expected two allocated questions.');
    }

    const totalMarks = allocationRows.reduce(
      (sum, question) => sum + Number(question.marks),
      0
    );

    if (totalMarks !== 15) {
      throw new Error(`Expected total marks 15, received ${totalMarks}.`);
    }

    pass('Both questions allocated with correct individual marks.');
    pass('Total marks correctly calculated as 15.');

    // ------------------------------------------------
    // OEP-F-010: Verify exam settings
    // ------------------------------------------------

    console.log('\n[TEST F-010] Exam configuration');

    if (
      Number(createdExam.duration_minutes) !== 60 ||
      Number(createdExam.shuffle) !== 1
    ) {
      throw new Error('Duration or shuffle settings were not saved.');
    }

    pass('Duration and shuffle settings saved correctly.');

    const [detailsResponse, detailsData] = [
      await teacherClient.fetch(`${BASE_URL}/api/exams/${examId}`),
      null
    ];

    const details = await readJson(detailsResponse);

    if (!detailsResponse.ok || !details.exam || !Array.isArray(details.questions)) {
      throw new Error('Exam details endpoint did not return expected data.');
    }

    if (details.questions.length !== 2) {
      throw new Error('Exam details did not return both questions.');
    }

    const detailMarks = details.questions.reduce(
      (sum, question) => sum + Number(question.marks),
      0
    );

    if (detailMarks !== 15) {
      throw new Error('Question marks in exam details are incorrect.');
    }

    pass('Exam details endpoint returns allocated questions and marks.');

    // Update draft exam settings.
    const updatePayload = {
      ...examPayload(questionIds, 'UPDATED'),
      title: `Updated Exam ${UNIQUE}`,
      durationMinutes: 90,
      shuffle: false
    };

    const updateResponse = await apiRequest(
      teacherClient,
      'PUT',
      `/api/exams/${examId}`,
      updatePayload
    );

    await expectStatus(updateResponse, 200, 'Draft exam update');

    const [updatedRows] = await pool.query(
      'SELECT title, duration_minutes, shuffle FROM exams WHERE id = ?',
      [examId]
    );

    if (
      updatedRows[0].title !== updatePayload.title ||
      Number(updatedRows[0].duration_minutes) !== 90 ||
      Number(updatedRows[0].shuffle) !== 0
    ) {
      throw new Error('Draft exam settings were not updated correctly.');
    }

    pass('Draft exam settings can be updated.');

    // ------------------------------------------------
    // OEP-F-011: Draft visibility
    // ------------------------------------------------

    console.log('\n[TEST F-011] Publishing and Student visibility');

    const studentDraftResponse = await studentClient.fetch(
      `${BASE_URL}/api/exams/${examId}`
    );

    if ([403, 404].includes(studentDraftResponse.status)) {
      pass('Student cannot retrieve an unpublished draft exam.');
    } else {
      await readJson(studentDraftResponse);
      throw new Error(
        `Student could retrieve draft exam. Received HTTP ${studentDraftResponse.status}.`
      );
    }

    const studentListResponse = await studentClient.fetch(
      `${BASE_URL}/api/exams`
    );

    const studentListData = await readJson(studentListResponse);

    if (!studentListResponse.ok || !Array.isArray(studentListData.exams)) {
      throw new Error('Student exam list could not be retrieved.');
    }

    if (studentListData.exams.some(exam => Number(exam.id) === Number(examId))) {
      throw new Error('Draft exam appeared in Student exam list.');
    }

    pass('Draft exam is absent from Student exam list.');

    // ------------------------------------------------
    // Publish exam
    // ------------------------------------------------

    const publishResponse = await apiRequest(
      teacherClient,
      'PATCH',
      `/api/exams/${examId}/publish`
    );

    await expectStatus(publishResponse, 200, 'Exam publishing');

    const [publishedRows] = await pool.query(
      'SELECT status FROM exams WHERE id = ?',
      [examId]
    );

    if (publishedRows[0].status !== 'published') {
      throw new Error('Exam status did not change to published.');
    }

    pass('Draft exam successfully transitioned to published.');

    // Published exams must not be editable.
    const publishedUpdate = await apiRequest(
      teacherClient,
      'PUT',
      `/api/exams/${examId}`,
      updatePayload
    );

    const publishedUpdateData = await readJson(publishedUpdate);

    if (
      publishedUpdate.status !== 409 ||
      publishedUpdateData.error?.code !== 'EXAM_NOT_DRAFT'
    ) {
      throw new Error('Published exam was not protected from editing.');
    }

    pass('Published exam cannot be edited.');

    // Publishing a second time must fail.
    const secondPublish = await apiRequest(
      teacherClient,
      'PATCH',
      `/api/exams/${examId}/publish`
    );

    const secondPublishData = await readJson(secondPublish);

    if (
      secondPublish.status !== 409 ||
      secondPublishData.error?.code !== 'ALREADY_PUBLISHED'
    ) {
      throw new Error('Duplicate publishing was not rejected.');
    }

    pass('Publishing an already published exam is rejected.');

    // ------------------------------------------------
    
    // Student list should include upcoming, active and past published exams.
    // ------------------------------------------------

    const futureExamStart = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const futureExamEnd = new Date(Date.now() + 26 * 60 * 60 * 1000);

    const expiredExamStart = new Date(Date.now() - 26 * 60 * 60 * 1000);
    const expiredExamEnd = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const activeExamStart = new Date(Date.now() - 60 * 60 * 1000);
    const activeExamEnd = new Date(Date.now() + 60 * 60 * 1000);

    for (const [title, start, end] of [
      ['FUTURE', futureExamStart, futureExamEnd],
      ['EXPIRED', expiredExamStart, expiredExamEnd],
      ['ACTIVE', activeExamStart, activeExamEnd]
    ]) {
      const [result] = await pool.query(
        `INSERT INTO exams
         (title, duration_minutes, start_datetime, end_datetime,
          shuffle, status, created_by)
         VALUES (?, 60, ?, ?, 0, 'published', ?)`,
        [
          `Exam Visibility ${title} ${UNIQUE}`,
          start,
          end,
          teacherId
        ]
      );

      examIds.push(result.insertId);

      await pool.query(
        `INSERT INTO exam_questions (exam_id, question_id, marks)
         VALUES (?, ?, 5)`,
        [result.insertId, questionIds[2]]
      );
    }

    const visibilityResponse = await studentClient.fetch(
      `${BASE_URL}/api/exams`
    );

    const visibilityData = await readJson(visibilityResponse);

    if (!visibilityResponse.ok) {
      throw new Error('Could not retrieve Student exam list.');
    }

    const visibleIds = visibilityData.exams.map(exam => Number(exam.id));

    const futureId = examIds[1];
    const expiredId = examIds[2];
    const activeId = examIds[3];

    if (!visibleIds.includes(futureId)) {
      throw new Error('Upcoming published exam was missing from Student list.');
    }

    pass('Upcoming published exam is visible to Student.');

    if (!visibleIds.includes(expiredId)) {
      throw new Error('Past published exam was missing from Student list.');
    }

    pass('Past published exam is visible to Student.');

    if (!visibleIds.includes(activeId)) {
      throw new Error('Active published exam was missing from Student list.');
    }

    pass('Active published exam is visible to Student.');

    // The main exam is scheduled for one hour in the future.
    if (!visibleIds.includes(examId)) {
      throw new Error('Main upcoming exam was missing from Student list.');
    }

    pass('Upcoming exam created through the API is visible to Student.');

    // ------------------------------------------------
    // Teacher list should include owned exams.
    // ------------------------------------------------


    // ------------------------------------------------
    // Teacher list should include owned exams.
    // ------------------------------------------------

    const teacherListResponse = await teacherClient.fetch(
      `${BASE_URL}/api/exams`
    );

    const teacherListData = await readJson(teacherListResponse);

    if (!teacherListResponse.ok || !Array.isArray(teacherListData.exams)) {
      throw new Error('Teacher exam list could not be retrieved.');
    }

    if (!teacherListData.exams.some(exam => Number(exam.id) === Number(examId))) {
      throw new Error('Teacher cannot see their own created exam.');
    }

    pass('Teacher can see their own created exam.');

    // ------------------------------------------------
    // Validation: invalid exam creation
    // ------------------------------------------------

    console.log('\n[TEST] Exam input validation');

    const invalidPayload = {
      ...examPayload(questionIds, 'INVALID'),
      durationMinutes: 0
    };

    const invalidResponse = await apiRequest(
      teacherClient,
      'POST',
      '/api/exams',
      invalidPayload
    );

    if (invalidResponse.status !== 400) {
      const invalidData = await readJson(invalidResponse);
      throw new Error(
        `Invalid duration was not rejected. ${JSON.stringify(invalidData)}`
      );
    }

    pass('Invalid zero-minute duration is rejected.');

    console.log('\n================================================');
    console.log(' EXAM MANAGEMENT TESTS COMPLETED');
    console.log(` PASSED: ${passed}`);
    console.log(` SKIPPED: ${skipped}`);
    console.log(' OEP-F-009, OEP-F-010, OEP-F-011');
    console.log('================================================');

  } catch (error) {
    console.error('\n>>> TEST FAILED:', error.message);
    process.exitCode = 1;

  } finally {
    console.log('\nCleaning up temporary test data...');

    try {
      if (examIds.length > 0) {
        const placeholders = examIds.map(() => '?').join(',');

        await pool.query(
          `DELETE FROM exams WHERE id IN (${placeholders})`,
          examIds
        );
      }

      if (questionIds.length > 0) {
        const placeholders = questionIds.map(() => '?').join(',');

        await pool.query(
          `DELETE FROM questions WHERE id IN (${placeholders})`,
          questionIds
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
