const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const db = require('../config/db');
const { sendOtpSms } = require('../utils/sms');

const router = express.Router();

const otpRequestLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 8 });
const otpVerifyLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 15 });

function generateOtp(length = 6) {
  const min = 10 ** (length - 1);
  const max = 10 ** length - 1;
  return String(crypto.randomInt(min, max));
}

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}

function setAuthCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

/**
 * POST /api/auth/register
 * Creates a student account. Student ID is generated server-side.
 */
router.post('/register', async (req, res) => {
  const { fullName, phone, email, password, grade } = req.body;
  if (!fullName || !phone || !password || !grade) {
    return res.status(400).json({ error: 'Full name, phone, password and grade are required.' });
  }

  const [existing] = await db.query('SELECT id FROM students WHERE phone = ?', [phone]);
  if (existing.length) {
    return res.status(409).json({ error: 'An account already exists with this phone number.' });
  }

  const [gradeRow] = await db.query('SELECT MAX(id) as maxId FROM students');
  const nextSeq = (gradeRow[0].maxId || 0) + 1;
  const studentId = `STU${new Date().getFullYear()}${String(nextSeq).padStart(3, '0')}`;
  const passwordHash = await bcrypt.hash(password, 12);

  await db.query(
    `INSERT INTO students (student_code, full_name, phone, email, password_hash, grade, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [studentId, fullName, phone, email || null, passwordHash, grade]
  );

  res.status(201).json({ studentId, message: 'Registration successful. You can now log in with your Student ID.' });
});

/**
 * POST /api/auth/request-otp
 * Body: { studentId }
 * Looks up the student, generates an OTP, stores its hash, and sends it by SMS.
 * The phone number is never returned to the client in full.
 */
router.post('/request-otp', otpRequestLimiter, async (req, res) => {
  const { studentId } = req.body;
  if (!studentId) return res.status(400).json({ error: 'Student ID is required.' });

  const [rows] = await db.query('SELECT id, phone, is_active FROM students WHERE student_code = ?', [studentId]);
  if (!rows.length) return res.status(404).json({ error: 'Student ID not found.' });
  const student = rows[0];
  if (!student.is_active) return res.status(403).json({ error: 'This account has been deactivated.' });

  const code = generateOtp(Number(process.env.OTP_LENGTH) || 6);
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + (Number(process.env.OTP_EXPIRY_MINUTES) || 5) * 60000);

  await db.query(
    `INSERT INTO otp_records (student_id, code_hash, expires_at, attempts, created_at)
     VALUES (?, ?, ?, 0, NOW())`,
    [student.id, codeHash, expiresAt]
  );

  await sendOtpSms(student.phone, code);

  const masked = student.phone.replace(/\d(?=\d{2})/g, '•');
  res.json({ message: 'OTP sent.', phoneMasked: masked });
});

/**
 * POST /api/auth/verify-otp
 * Body: { studentId, code }
 * Verifies the most recent OTP for the student, enforcing expiry and attempt limits.
 */
router.post('/verify-otp', otpVerifyLimiter, async (req, res) => {
  const { studentId, code } = req.body;
  if (!studentId || !code) return res.status(400).json({ error: 'Student ID and code are required.' });

  const [students] = await db.query('SELECT * FROM students WHERE student_code = ?', [studentId]);
  if (!students.length) return res.status(404).json({ error: 'Student not found.' });
  const student = students[0];

  const [otps] = await db.query(
    'SELECT * FROM otp_records WHERE student_id = ? ORDER BY id DESC LIMIT 1',
    [student.id]
  );
  if (!otps.length) return res.status(400).json({ error: 'No OTP was requested for this account.' });
  const otp = otps[0];

  if (new Date(otp.expires_at) < new Date()) {
    return res.status(400).json({ error: 'This code has expired. Please request a new one.' });
  }
  if (otp.attempts >= (Number(process.env.OTP_MAX_ATTEMPTS) || 5)) {
    return res.status(429).json({ error: 'Too many incorrect attempts. Please request a new code.' });
  }

  const valid = await bcrypt.compare(code, otp.code_hash);
  if (!valid) {
    await db.query('UPDATE otp_records SET attempts = attempts + 1 WHERE id = ?', [otp.id]);
    return res.status(400).json({ error: 'Incorrect code.' });
  }

  await db.query('DELETE FROM otp_records WHERE student_id = ?', [student.id]);

  const token = signToken({ id: student.id, studentCode: student.student_code, role: 'student' });
  setAuthCookie(res, token);

  res.json({
    message: 'Login successful.',
    student: {
      id: student.student_code,
      name: student.full_name,
      grade: student.grade,
    },
  });
});

/**
 * POST /api/auth/admin-login
 * Standard username/password login for teacher/admin accounts.
 */
router.post('/admin-login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' });

  const [rows] = await db.query('SELECT * FROM teachers WHERE username = ?', [username]);
  if (!rows.length) return res.status(401).json({ error: 'Invalid credentials.' });

  const teacher = rows[0];
  const valid = await bcrypt.compare(password, teacher.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials.' });

  const token = signToken({ id: teacher.id, role: 'teacher' });
  setAuthCookie(res, token);
  res.json({ message: 'Login successful.', teacher: { id: teacher.id, name: teacher.full_name } });
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out.' });
});

module.exports = router;
