const express = require('express');
const db = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Public: list all courses
router.get('/', async (req, res) => {
  const [rows] = await db.query('SELECT * FROM courses ORDER BY grade');
  res.json(rows);
});

// Public: single course with lesson count
router.get('/:id', async (req, res) => {
  const [rows] = await db.query('SELECT * FROM courses WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Course not found.' });
  res.json(rows[0]);
});

// Teacher/Admin only: create course
router.post('/', requireAuth, requireRole('teacher'), async (req, res) => {
  const { name, grade, description } = req.body;
  if (!name || !grade) return res.status(400).json({ error: 'Name and grade are required.' });
  const [result] = await db.query(
    'INSERT INTO courses (name, grade, description, created_at) VALUES (?, ?, ?, NOW())',
    [name, grade, description || null]
  );
  res.status(201).json({ id: result.insertId });
});

// Teacher/Admin only: edit course
router.put('/:id', requireAuth, requireRole('teacher'), async (req, res) => {
  const { name, grade, description } = req.body;
  await db.query('UPDATE courses SET name = ?, grade = ?, description = ? WHERE id = ?', [
    name, grade, description, req.params.id,
  ]);
  res.json({ message: 'Course updated.' });
});

// Teacher/Admin only: delete course
router.delete('/:id', requireAuth, requireRole('teacher'), async (req, res) => {
  await db.query('DELETE FROM courses WHERE id = ?', [req.params.id]);
  res.json({ message: 'Course deleted.' });
});

// Student progress for a course (requires login)
router.get('/:id/progress', requireAuth, requireRole('student'), async (req, res) => {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS total, SUM(sp.completed) AS completed
     FROM lessons l
     LEFT JOIN student_progress sp ON sp.lesson_id = l.id AND sp.student_id = ?
     WHERE l.course_id = ?`,
    [req.user.id, req.params.id]
  );
  const { total, completed } = rows[0];
  const pct = total > 0 ? Math.round(((completed || 0) / total) * 100) : 0;
  res.json({ total, completed: completed || 0, percent: pct });
});

module.exports = router;
