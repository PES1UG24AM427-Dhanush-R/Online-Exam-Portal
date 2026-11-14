
const pool = require('../../config/db');

// Convert ISO 8601 dates into MySQL DATETIME format (UTC).
function toMysqlDatetime(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid exam date.');
  }

  return date.toISOString().slice(0, 19).replace('T', ' ');
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/exams — create exam (OEP-F-009, OEP-F-010)
// ─────────────────────────────────────────────────────────────────────────────
exports.createExam = async (req, res, next) => {
  const {
    title,
    durationMinutes,
    startDatetime,
    endDatetime,
    shuffle,
    questions,
  } = req.body;

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [result] = await conn.query(
      `INSERT INTO exams
       (title, duration_minutes, start_datetime, end_datetime, shuffle, status, created_by)
       VALUES (?, ?, ?, ?, ?, 'draft', ?)`,
      [
        title,
        durationMinutes,
        toMysqlDatetime(startDatetime),
        toMysqlDatetime(endDatetime),
        shuffle ? 1 : 0,
        req.user.id,
      ]
    );

    const examId = result.insertId;

    for (const q of questions) {
      await conn.query(
        'INSERT INTO exam_questions (exam_id, question_id, marks) VALUES (?, ?, ?)',
        [examId, q.questionId, q.marks]
      );
    }

    await conn.commit();

    res.status(201).json({
      message: 'Exam created successfully.',
      examId,
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/exams/:id — update exam settings (OEP-F-010)
// Only draft exams can be updated.
// ─────────────────────────────────────────────────────────────────────────────
exports.updateExam = async (req, res, next) => {
  const { id } = req.params;
  const {
    title,
    durationMinutes,
    startDatetime,
    endDatetime,
    shuffle,
    questions,
  } = req.body;

  const conn = await pool.getConnection();

  try {
    const [exams] = await conn.query(
      'SELECT id, status FROM exams WHERE id = ? AND created_by = ?',
      [id, req.user.id]
    );

    if (exams.length === 0) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Exam not found.' },
      });
    }

    if (exams[0].status !== 'draft') {
      return res.status(409).json({
        error: {
          code: 'EXAM_NOT_DRAFT',
          message: 'Only draft exams can be edited.',
        },
      });
    }

    await conn.beginTransaction();

    await conn.query(
      `UPDATE exams
       SET title = ?, duration_minutes = ?, start_datetime = ?,
           end_datetime = ?, shuffle = ?
       WHERE id = ?`,
      [
        title,
        durationMinutes,
        toMysqlDatetime(startDatetime),
        toMysqlDatetime(endDatetime),
        shuffle ? 1 : 0,
        id,
      ]
    );

    if (questions && questions.length > 0) {
      await conn.query(
        'DELETE FROM exam_questions WHERE exam_id = ?',
        [id]
      );

      for (const q of questions) {
        await conn.query(
          'INSERT INTO exam_questions (exam_id, question_id, marks) VALUES (?, ?, ?)',
          [id, q.questionId, q.marks]
        );
      }
    }

    await conn.commit();

    res.json({ message: 'Exam updated successfully.' });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/exams/:id/publish — publish exam (OEP-F-011)
// ─────────────────────────────────────────────────────────────────────────────
exports.publishExam = async (req, res, next) => {
  const { id } = req.params;

  try {
    const [exams] = await pool.query(
      'SELECT id, status FROM exams WHERE id = ? AND created_by = ?',
      [id, req.user.id]
    );

    if (exams.length === 0) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Exam not found.' },
      });
    }

    if (exams[0].status !== 'draft') {
      return res.status(409).json({
        error: {
          code: 'ALREADY_PUBLISHED',
          message: 'This exam has already been published.',
        },
      });
    }

    const [qCount] = await pool.query(
      'SELECT COUNT(*) AS cnt FROM exam_questions WHERE exam_id = ?',
      [id]
    );

    if (qCount[0].cnt === 0) {
      return res.status(400).json({
        error: {
          code: 'NO_QUESTIONS',
          message: 'An exam must have at least one question before publishing.',
        },
      });
    }

    await pool.query(
      "UPDATE exams SET status = 'published' WHERE id = ?",
      [id]
    );

    res.json({ message: 'Exam published successfully.' });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/exams — list exams
// Teachers see their own exams.
// Students see only published exams within the availability window.
// ─────────────────────────────────────────────────────────────────────────────
exports.listExams = async (req, res, next) => {
  try {
    let exams;

    if (req.user.role === 'Teacher') {
      const [rows] = await pool.query(
        `SELECT e.*,
          (SELECT SUM(eq.marks)
           FROM exam_questions eq WHERE eq.exam_id = e.id) AS total_marks,
          (SELECT COUNT(*)
           FROM exam_questions eq WHERE eq.exam_id = e.id) AS question_count
         FROM exams e
         WHERE e.created_by = ?
         ORDER BY e.created_at DESC`,
        [req.user.id]
      );

      exams = rows;
    } else {
      const [rows] = await pool.query(
        `SELECT e.id, e.title, e.duration_minutes,
          e.start_datetime, e.end_datetime,
          (SELECT SUM(eq.marks)
           FROM exam_questions eq WHERE eq.exam_id = e.id) AS total_marks,
          (SELECT COUNT(*)
           FROM exam_questions eq WHERE eq.exam_id = e.id) AS question_count,
          (SELECT a.status
           FROM attempts a
           WHERE a.exam_id = e.id AND a.student_id = ?
           LIMIT 1) AS attempt_status
         FROM exams e
         WHERE e.status = 'published'
           AND e.start_datetime <= UTC_TIMESTAMP()
           AND e.end_datetime >= UTC_TIMESTAMP()
         ORDER BY e.start_datetime ASC`,
        [req.user.id]
      );

      exams = rows;
    }

    res.json({ exams });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/exams/:id — get single exam details
// Students can only access published exams within their availability window.
// Teachers can only access exams they created.
// ─────────────────────────────────────────────────────────────────────────────
exports.getExam = async (req, res, next) => {
  const { id } = req.params;

  try {
    let query = 'SELECT * FROM exams WHERE id = ?';
    const params = [id];

    if (req.user.role === 'Teacher') {
      query += ' AND created_by = ?';
      params.push(req.user.id);
    } else {
      query += ` AND status = 'published'
                 AND start_datetime <= UTC_TIMESTAMP()
                 AND end_datetime >= UTC_TIMESTAMP()`;
    }

    const [exams] = await pool.query(query, params);

    if (exams.length === 0) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Exam not found.' },
      });
    }

    const [questions] = await pool.query(
      `SELECT q.id, q.type, q.text, q.options, q.subject,
              q.topic, q.difficulty, eq.marks
       FROM questions q
       JOIN exam_questions eq ON q.id = eq.question_id
       WHERE eq.exam_id = ?`,
      [id]
    );

    res.json({ exam: exams[0], questions });
  } catch (err) {
    next(err);
  }
};
