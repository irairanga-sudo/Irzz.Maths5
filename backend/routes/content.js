const express = require('express');
const db = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

/* ---------------- VIDEO LESSONS ---------------- */

router.get('/lessons', async (req, res) => {
  const { courseId } = req.query;
  const sql = courseId
    ? 'SELECT * FROM lessons WHERE course_id = ? ORDER BY lesson_number'
    : 'SELECT * FROM lessons ORDER BY course_id, lesson_number';
  const [rows] = await db.query(sql, courseId ? [courseId] : []);
  res.json(rows);
});

router.post('/lessons', requireAuth, requireRole('teacher'), async (req, res) => {
  const { courseId, title, description, videoUrl, duration, lessonNumber } = req.body;
  const [result] = await db.query(
    `INSERT INTO lessons (course_id, title, description, video_url, duration, lesson_number, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [courseId, title, description, videoUrl, duration, lessonNumber]
  );
  res.status(201).json({ id: result.insertId });
});

router.delete('/lessons/:id', requireAuth, requireRole('teacher'), async (req, res) => {
  await db.query('DELETE FROM lessons WHERE id = ?', [req.params.id]);
  res.json({ message: 'Lesson deleted.' });
});

// Student marks a lesson complete/incomplete
router.post('/lessons/:id/progress', requireAuth, requireRole('student'), async (req, res) => {
  const { completed } = req.body;
  await db.query(
    `INSERT INTO student_progress (student_id, lesson_id, completed, updated_at)
     VALUES (?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE completed = VALUES(completed), updated_at = NOW()`,
    [req.user.id, req.params.id, completed ? 1 : 0]
  );
  res.json({ message: 'Progress updated.' });
});

/* ---------------- NOTES / PDFs ---------------- */

router.get('/notes', async (req, res) => {
  const { courseId } = req.query;
  const sql = courseId ? 'SELECT * FROM notes WHERE course_id = ?' : 'SELECT * FROM notes';
  const [rows] = await db.query(sql, courseId ? [courseId] : []);
  res.json(rows);
});

router.post('/notes', requireAuth, requireRole('teacher'), async (req, res) => {
  // fileUrl should point at a file already uploaded to your storage (e.g. S3, or
  // a local /uploads path served statically behind auth). This route only
  // stores the reference — wire up multer/S3 upload separately.
  const { courseId, title, description, fileUrl, downloadable } = req.body;
  const [result] = await db.query(
    `INSERT INTO notes (course_id, title, description, file_url, downloadable, created_at)
     VALUES (?, ?, ?, ?, ?, NOW())`,
    [courseId, title, description, fileUrl, downloadable ? 1 : 0]
  );
  res.status(201).json({ id: result.insertId });
});

router.put('/notes/:id', requireAuth, requireRole('teacher'), async (req, res) => {
  const { title, description, courseId } = req.body;
  await db.query('UPDATE notes SET title = ?, description = ?, course_id = ? WHERE id = ?', [
    title, description, courseId, req.params.id,
  ]);
  res.json({ message: 'Note updated.' });
});

router.delete('/notes/:id', requireAuth, requireRole('teacher'), async (req, res) => {
  await db.query('DELETE FROM notes WHERE id = ?', [req.params.id]);
  res.json({ message: 'Note deleted.' });
});

/* ---------------- ASSIGNMENTS ---------------- */

router.get('/assignments', requireAuth, async (req, res) => {
  if (req.user.role === 'teacher') {
    const [rows] = await db.query('SELECT * FROM assignments ORDER BY deadline');
    return res.json(rows);
  }
  // Student: include their own submission status
  const [rows] = await db.query(
    `SELECT a.*, s.status AS submission_status, s.marks AS submission_marks
     FROM assignments a
     LEFT JOIN assignment_submissions s ON s.assignment_id = a.id AND s.student_id = ?
     ORDER BY a.deadline`,
    [req.user.id]
  );
  res.json(rows);
});

router.post('/assignments', requireAuth, requireRole('teacher'), async (req, res) => {
  const { courseId, title, questions, deadline } = req.body;
  const [result] = await db.query(
    `INSERT INTO assignments (course_id, title, questions_json, deadline, created_at)
     VALUES (?, ?, ?, ?, NOW())`,
    [courseId, title, JSON.stringify(questions || []), deadline]
  );
  res.status(201).json({ id: result.insertId });
});

router.post('/assignments/:id/submit', requireAuth, requireRole('student'), async (req, res) => {
  const { answers } = req.body;
  await db.query(
    `INSERT INTO assignment_submissions (assignment_id, student_id, answers_json, status, submitted_at)
     VALUES (?, ?, ?, 'Submitted', NOW())
     ON DUPLICATE KEY UPDATE answers_json = VALUES(answers_json), status = 'Submitted', submitted_at = NOW()`,
    [req.params.id, req.user.id, JSON.stringify(answers || {})]
  );
  res.json({ message: 'Assignment submitted.' });
});

router.post('/assignments/:id/grade', requireAuth, requireRole('teacher'), async (req, res) => {
  const { studentId, marks } = req.body;
  await db.query(
    `UPDATE assignment_submissions SET marks = ?, status = 'Graded' WHERE assignment_id = ? AND student_id = ?`,
    [marks, req.params.id, studentId]
  );
  res.json({ message: 'Marks released.' });
});

module.exports = router;
