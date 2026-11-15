const pool = require('../../config/db');

/**
 * OEP-F-012 — server-side expiration handling for exam attempts.
 *
 * The SRS requires the SYSTEM to "automatically submit the exam when the
 * timer reaches zero". The browser client auto-submits when it is open, but if
 * the student's browser is closed at expiry no submission is created and the
 * autosaved answers are never graded (the attempt is only marked `timed_out`
 * on the next resume). This sweeper finalizes expired attempts server-side,
 * independently of the client.
 *
 * It must NOT break:
 *   - OEP-F-014 (autosave): autosave already rejects status === 'submitted'
 *     with 409, so once an attempt is finalized it cannot be overwritten.
 *   - OEP-F-015 (duplicate-submission prevention): the same atomic guard used
 *     by the submit handler is reused here (`UPDATE ... WHERE status =
 *     'in_progress'`), so the sweeper and a concurrent student submission can
 *     never both win — only one transitions the state and grades.
 *   - OEP-F-016 (grading): the scoring logic below is identical to
 *     ExamTakingModule.autoGrade in examTaking.controller.js (kept in sync by
 *     hand; duplicated here so this module does not edit the shared controller).
 *
 * The sweeper is disabled under NODE_ENV=test so it cannot interfere with the
 * automated test suites (including autosave, duplicate-submission and
 * exam-taking tests).
 */

const SWEEP_INTERVAL_MS = 30 * 1000;
let started = false;
let timer = null;

// OEP-F-016 scoring (mirror of ExamTakingModule.autoGrade).
async function gradeAttempt(attemptId, examId) {
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
    let correctAnswer = ans.correct_answer;
    if (typeof correctAnswer === 'string') {
      try { correctAnswer = JSON.parse(correctAnswer); } catch { /* keep raw value */ }
    }

    let score = 0;

    if (ans.type === 'MCQ_single' || ans.type === 'TrueFalse') {
      score = String(ans.response).trim() === String(correctAnswer).trim()
        ? parseFloat(ans.marks) : 0;
    } else if (ans.type === 'MCQ_multiple') {
      let studentAnswers = [];
      try {
        studentAnswers = typeof ans.response === 'string'
          ? JSON.parse(ans.response)
          : (ans.response || []);
      } catch { studentAnswers = []; }

      const correct = Array.isArray(correctAnswer) ? correctAnswer : [correctAnswer];
      const isCorrect =
        Array.isArray(studentAnswers) &&
        studentAnswers.length === correct.length &&
        correct.every((c) => studentAnswers.includes(c));

      score = isCorrect ? parseFloat(ans.marks) : 0;
    }

    await pool.query('UPDATE answers SET auto_score = ? WHERE id = ?', [score, ans.id]);
    totalScore += score;
  }

  await pool.query('UPDATE attempts SET total_score = ? WHERE id = ?', [totalScore, attemptId]);
}

/**
 * Finalize all expired attempts that still need grading:
 *   - in_progress attempts whose duration elapsed or whose exam window ended
 *     are auto-submitted (status -> 'submitted') and graded;
 *   - timed_out attempts that were never graded (student resumed after expiry
 *     before this sweeper ran) are graded without changing their status.
 */
async function finalizeExpiredAttempts() {
  const [expired] = await pool.query(
    `SELECT a.id AS attempt_id, a.exam_id, a.status
     FROM attempts a
     JOIN exams e ON a.exam_id = e.id
     WHERE a.status = 'in_progress'
       AND a.total_score IS NULL
       AND (TIMESTAMPDIFF(SECOND, a.start_time, NOW()) >= e.duration_minutes * 60
            OR e.end_datetime < NOW())`
  );

  for (const row of expired) {
    try {
      // Atomic guard shared with the submit handler: only the winner
      // transitions the state, preventing double grading.
      const [result] = await pool.query(
        "UPDATE attempts SET status = 'submitted', submitted_at = NOW() WHERE id = ? AND status = 'in_progress'",
        [row.attempt_id]
      );
      if (result.affectedRows > 0) {
        await gradeAttempt(row.attempt_id, row.exam_id);
      }
    } catch (err) {
      console.error('[expirySweeper] failed to finalize attempt', row.attempt_id, err.message);
    }
  }

  const [timedOut] = await pool.query(
    `SELECT a.id AS attempt_id, a.exam_id
     FROM attempts a
     JOIN exams e ON a.exam_id = e.id
     WHERE a.status = 'timed_out'
       AND a.total_score IS NULL
       AND (TIMESTAMPDIFF(SECOND, a.start_time, NOW()) >= e.duration_minutes * 60
            OR e.end_datetime < NOW())`
  );

  for (const row of timedOut) {
    try {
      await gradeAttempt(row.attempt_id, row.exam_id);
    } catch (err) {
      console.error('[expirySweeper] failed to grade timed_out attempt', row.attempt_id, err.message);
    }
  }
}

function start() {
  if (started) return;
  // Never run during automated tests — protect the test suites from
  // background finalization of their temporary attempts.
  if (process.env.NODE_ENV === 'test') return;

  started = true;
  timer = setInterval(() => {
    finalizeExpiredAttempts().catch((err) =>
      console.error('[expirySweeper] sweep error:', err.message)
    );
  }, SWEEP_INTERVAL_MS);

  // Do not keep the process alive solely for the sweeper.
  if (timer && typeof timer.unref === 'function') timer.unref();

  console.log(`[expirySweeper] started (interval ${SWEEP_INTERVAL_MS / 1000}s)`);
}

module.exports = { start, finalizeExpiredAttempts, gradeAttempt };
