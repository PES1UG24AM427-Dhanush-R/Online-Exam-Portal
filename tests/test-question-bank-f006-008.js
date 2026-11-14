/**
 * Automated Question Bank Verification
 *
 * Requirements:
 * OEP-F-006: Four supported question types
 * OEP-F-007: Subject, topic, difficulty and type filtering
 * OEP-F-008: Question editing, deletion and active-exam restrictions
 *
 * Teacher credentials can be configured through:
 * QB_TEACHER_EMAIL
 * QB_TEACHER_PASSWORD
 */

require('dotenv').config();

const crypto = require('crypto');
const pool = require('../backend/config/db');

const BASE_URL = process.env.APP_URL || 'http://localhost:3000';
const TEACHER_EMAIL = process.env.QB_TEACHER_EMAIL || 'qbtest@oep.com';
const TEACHER_PASSWORD = process.env.QB_TEACHER_PASSWORD || 'TeacherTest@123';

const UNIQUE = crypto.randomUUID().replace(/-/g, '');
const SUBJECT = `QBTest-${UNIQUE}`;
const TOPIC = `Topic-${UNIQUE}`;

class SessionClient {
  constructor() {
    this.cookies = new Map();
  }

  updateCookies(response) {
    let raw = [];

    if (typeof response.headers.getSetCookie === 'function') {
      raw = response.headers.getSetCookie();
    } else {
      const cookie = response.headers.get('set-cookie');
      if (cookie) raw = [cookie];
    }

    for (const item of raw) {
      const parts = item.split(';')[0].split('=');

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
    const headers = { ...(options.headers || {}) };
    const cookie = this.getCookieHeader();

    if (cookie) headers.Cookie = cookie;

    const response = await fetch(url, {
      ...options,
      headers
    });

    this.updateCookies(response);
    return response;
  }
}

async function getCsrfToken(client) {
  const response = await client.fetch(
    `${BASE_URL}/api/auth/csrf-token`
  );

  const data = await response.json();

  if (!response.ok || !data.csrfToken) {
    throw new Error('Could not obtain CSRF token.');
  }

  return data.csrfToken;
}

async function request(client, method, endpoint, body) {
  const csrfToken = await getCsrfToken(client);

  return client.fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken
    },
    ...(body !== undefined
      ? { body: JSON.stringify(body) }
      : {})
  });
}

function questionPayload(type, suffix) {
  const common = {
    type,
    text: `Automated Question Bank Test ${suffix} ${UNIQUE}`,
    subject: SUBJECT,
    topic: TOPIC,
    difficulty: 'Easy'
  };

  switch (type) {
    case 'MCQ_single':
      return {
        ...common,
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        correctAnswer: 'Option A'
      };

    case 'MCQ_multiple':
      return {
        ...common,
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        correctAnswer: ['Option A', 'Option C']
      };

    case 'TrueFalse':
      return {
        ...common,
        options: ['True', 'False'],
        correctAnswer: 'True'
      };

    case 'ShortAnswer':
      return {
        ...common,
        options: null,
        correctAnswer: 'Expected short answer'
      };

    default:
      throw new Error(`Unsupported test question type: ${type}`);
  }
}

async function readJson(response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      `Expected JSON response, received: ${text.slice(0, 300)}`
    );
  }
}

async function run() {
  const client = new SessionClient();

  const createdQuestionIds = [];
  let examId = null;
  let teacherId = null;

  console.log('==============================================');
  console.log(' QUESTION BANK TESTS: OEP-F-006 TO F-008');
  console.log('==============================================\n');

  try {
    // Find the dedicated Teacher account.
    const [teachers] = await pool.query(
      `SELECT id, role, is_active
       FROM users
       WHERE email = ?`,
      [TEACHER_EMAIL]
    );

    if (teachers.length === 0) {
      throw new Error(
        `Teacher account not found: ${TEACHER_EMAIL}. Check QB_TEACHER_EMAIL.`
      );
    }

    teacherId = teachers[0].id;

    if (teachers[0].role !== 'Teacher' || !teachers[0].is_active) {
      throw new Error(
        'The configured account must be an active Teacher.'
      );
    }

    console.log(`[1] Teacher account found. ID: ${teacherId}`);

    // Authenticate.
    const loginResponse = await request(
      client,
      'POST',
      '/api/auth/login',
      {
        email: TEACHER_EMAIL,
        password: TEACHER_PASSWORD
      }
    );

    const loginData = await readJson(loginResponse);

    if (loginResponse.status !== 200) {
      throw new Error(
        `Teacher login failed (${loginResponse.status}): ${JSON.stringify(loginData)}`
      );
    }

    if (loginData.role !== 'Teacher') {
      throw new Error('Authenticated account is not a Teacher.');
    }

    console.log('[2] Teacher login successful.');

    // ------------------------------------------------
    // OEP-F-006: Create all four question types.
    // ------------------------------------------------

    console.log('\n[TEST F-006] Creating four question types...');

    const types = [
      'MCQ_single',
      'MCQ_multiple',
      'TrueFalse',
      'ShortAnswer'
    ];

    for (const type of types) {
      const payload = questionPayload(type, type);

      const response = await request(
        client,
        'POST',
        '/api/questions',
        payload
      );

      const data = await readJson(response);

      if (response.status !== 201 || !data.questionId) {
        throw new Error(
          `${type} creation failed: ${JSON.stringify(data)}`
        );
      }

      createdQuestionIds.push(data.questionId);

      const [rows] = await pool.query(
        `SELECT id, type, text, subject, topic, difficulty
         FROM questions
         WHERE id = ? AND created_by = ?`,
        [data.questionId, teacherId]
      );

      if (rows.length !== 1 || rows[0].type !== type) {
        throw new Error(
          `Database verification failed for ${type}.`
        );
      }

      console.log(`  PASS: ${type} created and stored.`);
    }

    console.log('PASS: OEP-F-006 — all four question types created.');

    // ------------------------------------------------
    // OEP-F-007: Filter questions.
    // ------------------------------------------------

    console.log('\n[TEST F-007] Testing question filters...');

    const filters = [
      ['subject', SUBJECT],
      ['topic', TOPIC],
      ['difficulty', 'Easy'],
      ['type', 'MCQ_single']
    ];

    for (const [key, value] of filters) {
      const query = new URLSearchParams({ [key]: value });

      const response = await client.fetch(
        `${BASE_URL}/api/questions?${query.toString()}`
      );

      const data = await readJson(response);

      if (!response.ok || !Array.isArray(data.questions)) {
        throw new Error(
          `${key} filtering failed: ${JSON.stringify(data)}`
        );
      }

      const matching = data.questions.filter(question => {
        return String(question[key]) === value;
      });

      if (matching.length === 0) {
        throw new Error(
          `No matching questions returned for filter ${key}=${value}.`
        );
      }

      console.log(`  PASS: ${key} filter returned matching questions.`);
    }

    // ------------------------------------------------
    // OEP-F-008: Edit an unused question.
    // ------------------------------------------------

    console.log('\n[TEST F-008] Testing question editing...');

    const editableId = createdQuestionIds[0];

    const updatedPayload = {
      ...questionPayload('MCQ_single', 'UPDATED'),
      text: `Updated question ${UNIQUE}`,
      difficulty: 'Medium',
      topic: `${TOPIC}-Updated`
    };

    const updateResponse = await request(
      client,
      'PUT',
      `/api/questions/${editableId}`,
      updatedPayload
    );

    const updateData = await readJson(updateResponse);

    if (!updateResponse.ok) {
      throw new Error(
        `Editing unused question failed: ${JSON.stringify(updateData)}`
      );
    }

    const [updatedRows] = await pool.query(
      'SELECT text, difficulty, topic FROM questions WHERE id = ?',
      [editableId]
    );

    if (
      updatedRows.length !== 1 ||
      updatedRows[0].difficulty !== 'Medium' ||
      updatedRows[0].topic !== `${TOPIC}-Updated`
    ) {
      throw new Error('Updated question values were not saved correctly.');
    }

    console.log('  PASS: Unused question edited successfully.');

    // ------------------------------------------------
    // OEP-F-008: Prevent editing/deleting in active exam.
    // ------------------------------------------------

    console.log('\n[TEST F-008] Testing active-exam restrictions...');

    const protectedQuestionId = createdQuestionIds[1];

    const [examResult] = await pool.query(
  `INSERT INTO exams
   (title, duration_minutes, start_datetime, end_datetime,
    shuffle, status, created_by)
   VALUES (?, 60, NOW(), DATE_ADD(NOW(), INTERVAL 60 MINUTE), 0, 'published', ?)`,
  [
    `Question Bank Test Exam ${UNIQUE}`,
    teacherId
  ]
);

examId = examResult.insertId;

    await pool.query(
      `INSERT INTO exam_questions (exam_id, question_id, marks)
       VALUES (?, ?, 2.00)`,
      [examId, protectedQuestionId]
    );

    console.log('  Test exam created and question linked.');

    const protectedPayload = questionPayload(
      'MCQ_multiple',
      'PROTECTED'
    );

    const protectedEditResponse = await request(
      client,
      'PUT',
      `/api/questions/${protectedQuestionId}`,
      protectedPayload
    );

    const protectedEditData = await readJson(protectedEditResponse);

    if (
      protectedEditResponse.status !== 409 ||
      protectedEditData.error?.code !== 'QUESTION_IN_ACTIVE_EXAM'
    ) {
      throw new Error(
        `Expected active-exam edit to return 409 QUESTION_IN_ACTIVE_EXAM, got ${protectedEditResponse.status}: ${JSON.stringify(protectedEditData)}`
      );
    }

    console.log('  PASS: Editing question in active exam rejected.');

    const protectedDeleteResponse = await request(
      client,
      'DELETE',
      `/api/questions/${protectedQuestionId}`
    );

    const protectedDeleteData = await readJson(protectedDeleteResponse);

    if (
      protectedDeleteResponse.status !== 409 ||
      protectedDeleteData.error?.code !== 'QUESTION_IN_ACTIVE_EXAM'
    ) {
      throw new Error(
        `Expected active-exam deletion to return 409 QUESTION_IN_ACTIVE_EXAM, got ${protectedDeleteResponse.status}: ${JSON.stringify(protectedDeleteData)}`
      );
    }

    console.log('  PASS: Deleting question in active exam rejected.');

    // ------------------------------------------------
    // OEP-F-008: Prevent editing another Teacher's question.
    // ------------------------------------------------

    console.log('\n[TEST F-008] Testing question ownership...');

    const [otherTeacherQuestions] = await pool.query(
      `SELECT id
       FROM questions
       WHERE created_by <> ?
       LIMIT 1`,
      [teacherId]
    );

    if (otherTeacherQuestions.length > 0) {
      const otherId = otherTeacherQuestions[0].id;

      const ownershipResponse = await request(
        client,
        'PUT',
        `/api/questions/${otherId}`,
        questionPayload('MCQ_single', 'OWNERSHIP')
      );

      const ownershipData = await readJson(ownershipResponse);

      if (
        ownershipResponse.status !== 404 ||
        ownershipData.error?.code !== 'NOT_FOUND'
      ) {
        throw new Error(
          `Teacher could modify another Teacher's question: ${JSON.stringify(ownershipData)}`
        );
      }

      console.log(
        "    PASS: Editing another Teacher's question rejected."
      );
    } else {
      console.log(
        '  SKIP: No other Teacher-owned question exists for ownership test.'
      );
    }

    // ------------------------------------------------
    // OEP-F-008: Delete an unused question.
    // ------------------------------------------------

    console.log('\n[TEST F-008] Testing deletion of unused question...');

    const deletableId = createdQuestionIds[2];

    const deleteResponse = await request(
      client,
      'DELETE',
      `/api/questions/${deletableId}`
    );

    const deleteData = await readJson(deleteResponse);

    if (!deleteResponse.ok) {
      throw new Error(
        `Deleting unused question failed: ${JSON.stringify(deleteData)}`
      );
    }

    const [deletedRows] = await pool.query(
      'SELECT id FROM questions WHERE id = ?',
      [deletableId]
    );

    if (deletedRows.length !== 0) {
      throw new Error('Deleted question still exists in the database.');
    }

    console.log('  PASS: Unused question deleted successfully.');

    console.log('\n==============================================');
    console.log(' QUESTION BANK TESTS COMPLETED SUCCESSFULLY');
    console.log(' OEP-F-006, OEP-F-007, OEP-F-008');
    console.log('==============================================');

  } catch (error) {
    console.error('\n>>> TEST FAILED:', error.message);
    process.exitCode = 1;

  } finally {
    // Clean up the temporary exam and test questions.
    try {
      if (examId) {
        await pool.query(
          'DELETE FROM exam_questions WHERE exam_id = ?',
          [examId]
        );

        await pool.query(
          'DELETE FROM exams WHERE id = ?',
          [examId]
        );
      }

      if (createdQuestionIds.length > 0) {
        const placeholders = createdQuestionIds.map(() => '?').join(',');

        await pool.query(
          `DELETE FROM questions WHERE id IN (${placeholders})`,
          createdQuestionIds
        );
      }

      console.log('\nTemporary Question Bank test data cleaned up.');

    } catch (cleanupError) {
      console.error(
        'WARNING: Test cleanup failed:',
        cleanupError.message
      );
      process.exitCode = 1;
    }

    await pool.end();
  }
}

run();