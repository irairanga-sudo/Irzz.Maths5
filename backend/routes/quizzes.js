const express = require('express');
const db = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// List quizzes (without correct answers)
router.get('/', async (req, res) => {
  const [quizzes] = await db.query('SELECT id, course_id, title, duration_minutes, total_marks FROM quizzes');
  res.json(quizzes);
});

// Get one quiz's questions for attempting — correct answers are stripped out.
router.get('/:id', requireAuth, requireRole('student'), async (req, res) => {
  const [quizRows] = await db.query('SELECT * FROM quizzes WHERE id = ?', [req.params.id]);
  if (!quizRows.length) return res.status(404).json({ error: 'Test not found.' });
  const [questionRows] = await db.query(
    'SELECT id, question_text, question_type, options_json FROM questions WHERE quiz_id = ? ORDER BY position',
    [req.params.id]
  );
  res.json({
    ...quizRows[0],
    questions: questionRows.map(q => ({ ...q, options: JSON.parse(q.options_json || '[]') })),
  });
});

// Teacher: create quiz + questions
router.post('/', requireAuth, requireRole('teacher'), async (req, res) => {
  const { courseId, title, durationMinutes, totalMarks, questions } = req.body;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [quizResult] = await conn.query(
      `INSERT INTO quizzes (course_id, title, duration_minutes, total_marks, created_at) VALUES (?, ?, ?, ?, NOW())`,
      [courseId, title, durationMinutes, totalMarks]
    );
    const quizId = quizResult.insertId;
    for (const [i, q] of (questions || []).entries()) {
      await conn.query(
        `INSERT INTO questions (quiz_id, question_text, question_type, options_json, correct_answer, marks, position)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [quizId, q.text, q.type || 'mcq', JSON.stringify(q.options || []), q.correctAnswer, q.marks || 1, i]
      );
    }
    await conn.commit();
    res.status(201).json({ id: quizId });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: 'Failed to create test.' });
  } finally {
    conn.release();
  }
});

// Student: submit attempt — server grades it, client never sees correct answers in advance.
router.post('/:id/submit', requireAuth, requireRole('student'), async (req, res) => {
  const { answers } = req.body; // { questionId: selectedValue }
  const quizId = req.params.id;

  const [questions] = await db.query('SELECT * FROM questions WHERE quiz_id = ?', [quizId]);
  const [[quiz]] = await db.query('SELECT * FROM quizzes WHERE id = ?', [quizId]);

  let scored = 0;
  const breakdown = questions.map(q => {
    const given = answers?.[q.id];
    const correct = String(given) === String(q.correct_answer);
    if (correct) scored += q.marks;
    return { questionId: q.id, correct };
  });

  const pct = questions.length ? Math.round((scored / (quiz.total_marks || scored || 1)) * 100) : 0;
  const grade = pct >= 75 ? 'A' : pct >= 65 ? 'B' : pct >= 50 ? 'C' : 'S';

  const [existingAttempts] = await db.query(
    'SELECT COUNT(*) AS n FROM quiz_attempts WHERE quiz_id = ? AND student_id = ?',
    [quizId, req.user.id]
  );

  await db.query(
    `INSERT INTO quiz_attempts (quiz_id, student_id, score, percentage, grade, attempt_number, submitted_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [quizId, req.user.id, scored, pct, grade, existingAttempts[0].n + 1]
  );

  res.json({ score: scored, totalMarks: quiz.total_marks, percentage: pct, grade, breakdown });
});

module.exports = router;
