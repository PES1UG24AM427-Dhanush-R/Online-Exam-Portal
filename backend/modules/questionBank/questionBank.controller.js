const pool = require('../../config/db');

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/questions — create a question (OEP-F-006)
// ─────────────────────────────────────────────────────────────────────────────
exports.createQuestion = async (req, res, next) => {
  const { type, text, options, correctAnswer, subject, topic, difficulty } = req.body;

  try {
    const [result] = await pool.query(
      `INSERT INTO questions (type, text, options, correct_answer, subject, topic, difficulty, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        type,
        text,
        options ? JSON.stringify(options) : null,
        JSON.stringify(correctAnswer),
        subject,
        topic,
        difficulty,
        req.user.id,
      ]
    );

    res.status(201).json({ message: 'Question created successfully.', questionId: result.insertId });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/questions — list questions with optional filters (OEP-F-007)
// ─────────────────────────────────────────────────────────────────────────────
exports.listQuestions = async (req, res, next) => {
  const { subject, topic, difficulty, type } = req.query;

  try {
    let query = 'SELECT * FROM questions WHERE created_by = ?';
    const params = [req.user.id];

    if (subject)    { query += ' AND subject = ?';    params.push(subject); }
    if (topic)      { query += ' AND topic = ?';      params.push(topic); }
    if (difficulty) { query += ' AND difficulty = ?'; params.push(difficulty); }
    if (type)       { query += ' AND type = ?';       params.push(type); }

    query += ' ORDER BY created_at DESC';

    const [questions] = await pool.query(query, params);
    res.json({ questions });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/questions/:id — edit question (OEP-F-008)
// Cannot edit if question is in an active or upcoming exam
// ─────────────────────────────────────────────────────────────────────────────
exports.updateQuestion = async (req, res, next) => {
  const { id } = req.params;
  const { type, text, options, correctAnswer, subject, topic, difficulty } = req.body;

  try {
    // Verify ownership
    const [questions] = await pool.query(
      'SELECT id FROM questions WHERE id = ? AND created_by = ?',
      [id, req.user.id]
    );
    if (questions.length === 0) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Question not found.' },
      });
    }

    // Check if question is used in an active or upcoming exam
    const [activeExams] = await pool.query(
      `SELECT e.id FROM exams e
       JOIN exam_questions eq ON e.id = eq.exam_id
       WHERE eq.question_id = ?
         AND e.status IN ('published')
         AND e.end_datetime > NOW()`,
      [id]
    );

    if (activeExams.length > 0) {
      return res.status(409).json({
        error: {
          code: 'QUESTION_IN_ACTIVE_EXAM',
          message: 'This question cannot be edited because it is part of an active or upcoming exam.',
        },
      });
    }

    await pool.query(
      `UPDATE questions SET type = ?, text = ?, options = ?, correct_answer = ?,
       subject = ?, topic = ?, difficulty = ? WHERE id = ?`,
      [
        type,
        text,
        options ? JSON.stringify(options) : null,
        JSON.stringify(correctAnswer),
        subject,
        topic,
        difficulty,
        id,
      ]
    );

    res.json({ message: 'Question updated successfully.' });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/questions/:id — delete question (OEP-F-008)
// ─────────────────────────────────────────────────────────────────────────────
exports.deleteQuestion = async (req, res, next) => {
  const { id } = req.params;

  try {
    const [questions] = await pool.query(
      'SELECT id FROM questions WHERE id = ? AND created_by = ?',
      [id, req.user.id]
    );
    if (questions.length === 0) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Question not found.' },
      });
    }

    // Check active/upcoming exam usage
    const [activeExams] = await pool.query(
      `SELECT e.id FROM exams e
       JOIN exam_questions eq ON e.id = eq.exam_id
       WHERE eq.question_id = ?
         AND e.status = 'published'
         AND e.end_datetime > NOW()`,
      [id]
    );

    if (activeExams.length > 0) {
      return res.status(409).json({
        error: {
          code: 'QUESTION_IN_ACTIVE_EXAM',
          message: 'This question cannot be deleted because it is part of an active or upcoming exam.',
        },
      });
    }

    await pool.query('DELETE FROM questions WHERE id = ?', [id]);
    res.json({ message: 'Question deleted successfully.' });
  } catch (err) {
    next(err);
  }
};
