const pool = require('../../config/db');

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/grading/:attemptId — get answers for manual grading (OEP-F-017)
// ─────────────────────────────────────────────────────────────────────────────
exports.getAttemptForGrading = async (req, res, next) => {
  const { attemptId } = req.params;

  try {
    // Verify the attempt belongs to an exam created by this Teacher
    const [attempts] = await pool.query(
      `SELECT a.*, u.full_name AS student_name, e.title AS exam_title
       FROM attempts a
       JOIN users u ON a.student_id = u.id
       JOIN exams e ON a.exam_id = e.id
       WHERE a.id = ? AND e.created_by = ?`,
      [attemptId, req.user.id]
    );

    if (attempts.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Attempt not found.' } });
    }

    const [answers] = await pool.query(
      `SELECT a.id, a.question_id, q.type, q.text, a.response,
              a.auto_score, a.manual_score, eq.marks AS max_marks
       FROM answers a
       JOIN questions q ON a.question_id = q.id
       JOIN exam_questions eq ON (eq.question_id = q.id AND eq.exam_id = ?)
       WHERE a.attempt_id = ?`,
      [attempts[0].exam_id, attemptId]
    );

    res.json({ attempt: attempts[0], answers });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/grading/:attemptId — save manual scores (OEP-F-017)
// ─────────────────────────────────────────────────────────────────────────────
exports.saveManualScores = async (req, res, next) => {
  const { attemptId } = req.params;
  const { scores } = req.body; // [{ answerId, score }]

  const conn = await pool.getConnection();
  try {
    // Verify ownership
    const [attempts] = await conn.query(
      `SELECT a.id, a.exam_id FROM attempts a
       JOIN exams e ON a.exam_id = e.id
       WHERE a.id = ? AND e.created_by = ?`,
      [attemptId, req.user.id]
    );

    if (attempts.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Attempt not found.' } });
    }

    await conn.beginTransaction();

    for (const s of scores) {
      await conn.query('UPDATE answers SET manual_score = ? WHERE id = ? AND attempt_id = ?', [
        s.score, s.answerId, attemptId,
      ]);
    }

    // Recalculate total score (auto_score for MCQ/TF + manual_score for ShortAnswer)
    const [scoreRows] = await conn.query(
      `SELECT
        COALESCE(SUM(CASE WHEN q.type IN ('MCQ_single','MCQ_multiple','TrueFalse') THEN a.auto_score ELSE 0 END), 0) AS obj_score,
        COALESCE(SUM(CASE WHEN q.type = 'ShortAnswer' THEN a.manual_score ELSE 0 END), 0) AS subj_score
       FROM answers a JOIN questions q ON a.question_id = q.id
       WHERE a.attempt_id = ?`,
      [attemptId]
    );

    const totalScore = parseFloat(scoreRows[0].obj_score) + parseFloat(scoreRows[0].subj_score);
    await conn.query('UPDATE attempts SET total_score = ? WHERE id = ?', [totalScore, attemptId]);

    await conn.commit();
    res.json({ message: 'Scores saved successfully.', totalScore });
  } catch (err) {
    await conn.rollback().catch(() => {});
    next(err);
  } finally {
    conn.release();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/grading/:examId/release — release results to Students (OEP-F-018)
// ─────────────────────────────────────────────────────────────────────────────
exports.releaseResults = async (req, res, next) => {
  const { examId } = req.params;

  try {
    const [exams] = await pool.query(
      'SELECT id FROM exams WHERE id = ? AND created_by = ?',
      [examId, req.user.id]
    );
    if (exams.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Exam not found.' } });
    }

    // Idempotent insert
    await pool.query(
      `INSERT INTO results_released (exam_id, released_by)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE released_at = NOW()`,
      [examId, req.user.id]
    );

    res.json({ message: 'Results released to students successfully.' });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/grading/results/:examId — Student views their result (OEP-F-018)
// Only visible after Teacher releases results
// ─────────────────────────────────────────────────────────────────────────────
exports.getMyResult = async (req, res, next) => {
  const { examId } = req.params;

  try {
    // Check results are released
    const [released] = await pool.query(
      'SELECT exam_id FROM results_released WHERE exam_id = ?',
      [examId]
    );
    if (released.length === 0) {
      return res.status(403).json({
        error: { code: 'RESULTS_NOT_RELEASED', message: 'Results have not been released yet.' },
      });
    }

    const [attempts] = await pool.query(
      `SELECT a.id, a.total_score, a.submitted_at,
              e.title AS exam_title,
              (SELECT SUM(eq.marks) FROM exam_questions eq WHERE eq.exam_id = e.id) AS total_marks
       FROM attempts a JOIN exams e ON a.exam_id = e.id
       WHERE a.exam_id = ? AND a.student_id = ?`,
      [examId, req.user.id]
    );

    if (attempts.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No attempt found for this exam.' } });
    }

    res.json({ result: attempts[0] });
  } catch (err) {
    next(err);
  }
};
