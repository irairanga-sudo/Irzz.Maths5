const express = require('express');
const db = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

/* ---------------- RESULTS ---------------- */

// Logged-in student: their own results
router.get('/results', requireAuth, requireRole('student'), async (req, res) => {
  const [rows] = await db.query(
    `SELECT qz.title AS test, qa.submitted_at AS date, qa.score, qz.total_marks,
            qa.percentage, qa.grade, qa.attempt_number AS attempt
     FROM quiz_attempts qa
     JOIN quizzes qz ON qz.id = qa.quiz_id
     WHERE qa.student_id = ?
     ORDER BY qa.submitted_at DESC`,
    [req.user.id]
  );
  res.json(rows);
});

// Teacher: class-wide results / performance
router.get('/results/class', requireAuth, requireRole('teacher'), async (req, res) => {
  const [rows] = await db.query(
    `SELECT s.student_code, s.full_name, qz.title AS test, qa.percentage, qa.grade, qa.submitted_at
     FROM quiz_attempts qa
     JOIN students s ON s.id = qa.student_id
     JOIN quizzes qz ON qz.id = qa.quiz_id
     ORDER BY qa.submitted_at DESC`
  );
  res.json(rows);
});

/* ---------------- CLASS SCHEDULE ---------------- */

router.get('/schedule', async (req, res) => {
  const [rows] = await db.query(
    `SELECT sc.*, c.name AS course_name, c.grade
     FROM schedule sc JOIN courses c ON c.id = sc.course_id
     ORDER BY sc.class_date, sc.start_time`
  );
  res.json(rows);
});

router.post('/schedule', requireAuth, requireRole('teacher'), async (req, res) => {
  const { courseId, classDate, startTime, endTime, lessonTitle, onlineLink } = req.body;
  const [result] = await db.query(
    `INSERT INTO schedule (course_id, class_date, start_time, end_time, lesson_title, online_link)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [courseId, classDate, startTime, endTime, lessonTitle, onlineLink]
  );
  res.status(201).json({ id: result.insertId });
});

router.delete('/schedule/:id', requireAuth, requireRole('teacher'), async (req, res) => {
  await db.query('DELETE FROM schedule WHERE id = ?', [req.params.id]);
  res.json({ message: 'Class removed from schedule.' });
});

/* ---------------- ANNOUNCEMENTS ---------------- */

router.get('/announcements', async (req, res) => {
  const [rows] = await db.query('SELECT * FROM announcements ORDER BY created_at DESC');
  res.json(rows);
});

router.post('/announcements', requireAuth, requireRole('teacher'), async (req, res) => {
  const { title, body, type } = req.body;
  const [result] = await db.query(
    'INSERT INTO announcements (title, body, type, created_at) VALUES (?, ?, ?, NOW())',
    [title, body, type || 'Notice']
  );
  res.status(201).json({ id: result.insertId });
});

router.delete('/announcements/:id', requireAuth, requireRole('teacher'), async (req, res) => {
  await db.query('DELETE FROM announcements WHERE id = ?', [req.params.id]);
  res.json({ message: 'Announcement deleted.' });
});

module.exports = router;
