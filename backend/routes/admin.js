const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// All routes here are teacher/admin only.
router.use(requireAuth, requireRole('teacher'));

router.get('/students', async (req, res) => {
  const { search } = req.query;
  const sql = search
    ? `SELECT id, student_code, full_name, phone, grade, is_active FROM students
       WHERE full_name LIKE ? OR student_code LIKE ? ORDER BY id DESC`
    : `SELECT id, student_code, full_name, phone, grade, is_active FROM students ORDER BY id DESC`;
  const params = search ? [`%${search}%`, `%${search}%`] : [];
  const [rows] = await db.query(sql, params);
  res.json(rows);
});

router.post('/students', async (req, res) => {
  const { fullName, phone, email, grade, password } = req.body;
  const passwordHash = await bcrypt.hash(password || 'changeme', 12);
  const [gradeRow] = await db.query('SELECT MAX(id) as maxId FROM students');
  const nextSeq = (gradeRow[0].maxId || 0) + 1;
  const studentId = `STU${new Date().getFullYear()}${String(nextSeq).padStart(3, '0')}`;

  await db.query(
    `INSERT INTO students (student_code, full_name, phone, email, password_hash, grade, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, NOW())`,
    [studentId, fullName, phone, email || null, passwordHash, grade]
  );
  res.status(201).json({ studentId });
});

router.put('/students/:id', async (req, res) => {
  const { fullName, phone, email, grade } = req.body;
  await db.query('UPDATE students SET full_name=?, phone=?, email=?, grade=? WHERE id=?', [
    fullName, phone, email, grade, req.params.id,
  ]);
  res.json({ message: 'Student updated.' });
});

router.post('/students/:id/deactivate', async (req, res) => {
  await db.query('UPDATE students SET is_active = 0 WHERE id = ?', [req.params.id]);
  res.json({ message: 'Student deactivated.' });
});

router.delete('/students/:id', async (req, res) => {
  await db.query('DELETE FROM students WHERE id = ?', [req.params.id]);
  res.json({ message: 'Student deleted.' });
});

router.get('/students/:id/progress', async (req, res) => {
  const [rows] = await db.query(
    `SELECT c.name AS course, c.grade,
            COUNT(l.id) AS total_lessons,
            SUM(sp.completed) AS completed_lessons
     FROM courses c
     JOIN lessons l ON l.course_id = c.id
     LEFT JOIN student_progress sp ON sp.lesson_id = l.id AND sp.student_id = ?
     GROUP BY c.id`,
    [req.params.id]
  );
  res.json(rows);
});

module.exports = router;
