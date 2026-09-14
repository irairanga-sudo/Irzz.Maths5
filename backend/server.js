require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const courseRoutes = require('./routes/courses');
const contentRoutes = require('./routes/content');
const quizRoutes = require('./routes/quizzes');
const miscRoutes = require('./routes/misc');
const adminRoutes = require('./routes/admin');

const app = express();

// ----- Security middleware -----
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser(process.env.COOKIE_SECRET));

// Global rate limit — protects against brute force / scraping
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));

// ----- Routes -----
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api', contentRoutes);       // /api/lessons, /api/notes, /api/assignments
app.use('/api/quizzes', quizRoutes);
app.use('/api', miscRoutes);          // /api/results, /api/schedule, /api/announcements
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Central error handler — never leak stack traces or DB errors to the client.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Irzz.Maths.LK API running on port ${PORT}`));
