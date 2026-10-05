const pool = require('../../config/db');

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/attempt/start — start exam attempt (OEP-F-012, OEP-F-013, OEP-F-015)
// ─────────────────────────────────────────────────────────────────────────────
exports.startAttempt = async (req, res, next) => {
  const { examId } = req.body;
  const studentId = req.user.id;

  const conn = await pool.getConnection();
  try {
    // Fetch exam and check it exists and is published
    const [exams] = await conn.query(
      'SELECT * FROM exams WHERE id = ? AND status = ?',
      [examId, 'published']
    );
    if (exams.length === 0) {
      return res.status(404).json({ error: { code: 'EXAM_NOT_FOUND', message: 'Exam not found.' } });
    }

    const exam = exams[0];
    const now = new Date();

    // Enforce exam access window (OEP-F-013)
    if (now < new Date(exam.start_datetime)) {
      return res.status(403).json({
        error: { code: 'EXAM_NOT_STARTED', message: 'This exam has not started yet.' },
      });
    }
    if (now > new Date(exam.end_datetime)) {
      return res.status(403).json({
        error: { code: 'EXAM_ENDED', message: 'This exam has already ended.' },
      });
    }

    // Prevent duplicate attempts (OEP-F-015)
    const [existing] = await conn.query(
      'SELECT id, status FROM attempts WHERE student_id = ? AND exam_id = ?',
      [studentId, examId]
    );
    if (existing.length > 0) {
      if (existing[0].status === 'submitted') {
        return res.status(409).json({
          error: { code: 'ALREADY_SUBMITTED', message: 'You have already submitted this exam.' },
        });
      }
      // Resume in-progress attempt
      const attemptId = existing[0].id;
      const questions = await getQuestionsForAttempt(conn, examId, exam.shuffle);
      const savedAnswers = await getSavedAnswers(conn, attemptId);
      const [attempt] = await conn.query('SELECT start_time FROM attempts WHERE id = ?', [attemptId]);
      const elapsedSeconds = Math.floor((now - new Date(attempt[0].start_time)) / 1000);
      const remainingSeconds = Math.max(0, exam.duration_minutes * 60 - elapsedSeconds);

      return res.json({
        attemptId,
        questions,
        savedAnswers,
        durationSeconds: exam.duration_minutes * 60,
        remainingSeconds,
        serverTime: now.toISOString(),
      });
    }

    // Create new attempt with server-side start timestamp
    await conn.beginTransaction();
    const [result] = await conn.query(
      'INSERT INTO attempts (student_id, exam_id, start_time, status) VALUES (?, ?, NOW(), ?)',
      [studentId, examId, 'in_progress']
    );
    await conn.commit();

    const attemptId = result.insertId;
    const questions = await getQuestionsForAttempt(conn, examId, exam.shuffle);

    res.status(201).json({
      attemptId,
      questions,
      savedAnswers: [],
      durationSeconds: exam.duration_minutes * 60,
      remainingSeconds: exam.duration_minutes * 60,
      serverTime: now.toISOString(),
    });
  } catch (err) {
    await conn.rollback().catch(() => {});
    next(err);
  } finally {
    conn.release();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/attempt/:id/autosave — auto-save answers (OEP-F-014)
// ─────────────────────────────────────────────────────────────────────────────
exports.autosave = async (req, res, next) => {
  const { id: attemptId } = req.params;
  const { answers } = req.body; // [{ questionId, response }]

  try {
    const [attempts] = await pool.query(
      'SELECT id, status FROM attempts WHERE id = ? AND student_id = ?',
      [attemptId, req.user.id]
    );
    if (attempts.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Attempt not found.' } });
    }
    if (attempts[0].status === 'submitted') {
      return res.status(409).json({
        error: { code: 'ALREADY_SUBMITTED', message: 'This exam has already been submitted.' },
      });
    }

    // Upsert each answer
    for (const ans of answers) {
      await pool.query(
        `INSERT INTO answers (attempt_id, question_id, response)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE response = VALUES(response)`,
        [attemptId, ans.questionId, ans.response]
      );
    }

    res.json({ message: 'Answers saved.', savedAt: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/attempt/:id/submit — final submission (OEP-F-015, OEP-F-016)
// ─────────────────────────────────────────────────────────────────────────────
exports.submit = async (req, res, next) => {
  const { id: attemptId } = req.params;
  const { answers } = req.body;

  const conn = await pool.getConnection();
  try {
    const [attempts] = await conn.query(
      `SELECT a.*, e.duration_minutes, e.end_datetime
       FROM attempts a JOIN exams e ON a.exam_id = e.id
       WHERE a.id = ? AND a.student_id = ?`,
      [attemptId, req.user.id]
    );

    if (attempts.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Attempt not found.' } });
    }

    const attempt = attempts[0];

    if (attempt.status === 'submitted') {
      return res.status(409).json({
        error: { code: 'ALREADY_SUBMITTED', message: 'This exam has already been submitted.' },
      });
    }

    // Server-side: check exam window hasn't passed (OEP-F-013)
    const now = new Date();
    if (now > new Date(attempt.end_datetime)) {
      return res.status(403).json({
        error: { code: 'EXAM_WINDOW_EXPIRED', message: 'The exam time window has expired.' },
      });
    }

    await conn.beginTransaction();

    // Save final answers (upsert)
    for (const ans of answers) {
      await conn.query(
        `INSERT INTO answers (attempt_id, question_id, response)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE response = VALUES(response)`,
        [attemptId, ans.questionId, ans.response]
      );
    }

    // Mark attempt as submitted
    await conn.query(
      "UPDATE attempts SET status = 'submitted', submitted_at = NOW() WHERE id = ?",
      [attemptId]
    );

    await conn.commit();

    // Trigger auto-grading (OEP-F-016)
    autoGrade(attemptId, attempt.exam_id).catch((err) =>
      console.error('[AUTO-GRADE ERROR]', err)
    );

    res.json({ message: 'Exam submitted successfully.', submittedAt: now.toISOString() });
  } catch (err) {
    await conn.rollback().catch(() => {});
    next(err);
  } finally {
    conn.release();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Internal: auto-grade MCQ and TrueFalse answers (OEP-F-016)
// ─────────────────────────────────────────────────────────────────────────────
async function autoGrade(attemptId, examId) {
  const [answers] = await pool.query(
    `SELECT a.id, a.question_id, a.response, q.type, q.correct_answer, eq.marks
     FROM answers a
     JOIN questions q ON a.question_id = q.id
     JOIN exam_questions eq ON (eq.question_id = q.id AND eq.exam_id = ?)
     WHERE a.attempt_id = ? AND q.type IN ('MCQ_single', 'MCQ_multiple', 'TrueFalse')`,
    [examId, attemptId]
  );

  let totalScore = 0;

  for (const ans of answers) {
    const correctAnswer = JSON.parse(ans.correct_answer);
    let score = 0;

    if (ans.type === 'MCQ_single' || ans.type === 'TrueFalse') {
      score = ans.response === correctAnswer ? parseFloat(ans.marks) : 0;
    } else if (ans.type === 'MCQ_multiple') {
      // All selected options must match exactly
      let studentAnswers = [];
      try { studentAnswers = JSON.parse(ans.response); } catch { studentAnswers = []; }
      const correct = Array.isArray(correctAnswer) ? correctAnswer : [correctAnswer];
      const isCorrect =
        studentAnswers.length === correct.length &&
        correct.every((c) => studentAnswers.includes(c));
      score = isCorrect ? parseFloat(ans.marks) : 0;
    }

    await pool.query('UPDATE answers SET auto_score = ? WHERE id = ?', [score, ans.id]);
    totalScore += score;
  }

  // Update total score on attempt
  await pool.query('UPDATE attempts SET total_score = ? WHERE id = ?', [totalScore, attemptId]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
async function getQuestionsForAttempt(conn, examId, shuffle) {
  let [questions] = await conn.query(
    `SELECT q.id AS questionId, q.type, q.text, q.options, eq.marks
     FROM questions q JOIN exam_questions eq ON q.id = eq.question_id
     WHERE eq.exam_id = ?`,
    [examId]
  );

  // Shuffle if configured (OEP-F-010)
  if (shuffle) {
    questions = questions.sort(() => Math.random() - 0.5);
  }

  // Parse options JSON
  return questions.map((q) => ({
    ...q,
    options: q.options ? JSON.parse(q.options) : [],
  }));
}

async function getSavedAnswers(conn, attemptId) {
  const [answers] = await conn.query(
    'SELECT question_id AS questionId, response FROM answers WHERE attempt_id = ?',
    [attemptId]
  );
  return answers;
}
