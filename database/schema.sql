-- =========================================================
-- Irzz.Maths.LK — Database Schema (MySQL 8+)
-- Run:  mysql -u root -p < schema.sql
-- =========================================================

CREATE DATABASE IF NOT EXISTS irzz_maths_lk CHARACTER SET utf8mb4;
USE irzz_maths_lk;

-- ---------------------------------------------------------
-- Teachers / Admins
-- ---------------------------------------------------------
CREATE TABLE teachers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  education VARCHAR(255),
  contact VARCHAR(30),
  created_at DATETIME NOT NULL
);

-- ---------------------------------------------------------
-- Students
-- ---------------------------------------------------------
CREATE TABLE students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_code VARCHAR(20) NOT NULL UNIQUE,   -- e.g. STU2026001
  full_name VARCHAR(120) NOT NULL,
  phone VARCHAR(20) NOT NULL UNIQUE,
  email VARCHAR(150),
  password_hash VARCHAR(255) NOT NULL,
  grade VARCHAR(20) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL
);

-- ---------------------------------------------------------
-- OTP records (one row per requested code; deleted after use)
-- ---------------------------------------------------------
CREATE TABLE otp_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  code_hash VARCHAR(255) NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------
-- Courses
-- ---------------------------------------------------------
CREATE TABLE courses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  grade VARCHAR(20) NOT NULL,
  description TEXT,
  created_at DATETIME NOT NULL
);

-- ---------------------------------------------------------
-- Lessons (video lessons)
-- ---------------------------------------------------------
CREATE TABLE lessons (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NOT NULL,
  title VARCHAR(180) NOT NULL,
  description TEXT,
  video_url VARCHAR(500),
  duration VARCHAR(20),
  lesson_number INT,
  created_at DATETIME NOT NULL,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- Tracks whether a student has completed a lesson
CREATE TABLE student_progress (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  lesson_id INT NOT NULL,
  completed TINYINT(1) NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uniq_student_lesson (student_id, lesson_id),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------
-- Notes / PDF materials
-- ---------------------------------------------------------
CREATE TABLE notes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NOT NULL,
  title VARCHAR(180) NOT NULL,
  description TEXT,
  file_url VARCHAR(500) NOT NULL,
  downloadable TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------
-- Assignments
-- ---------------------------------------------------------
CREATE TABLE assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NOT NULL,
  title VARCHAR(180) NOT NULL,
  questions_json JSON,
  deadline DATE NOT NULL,
  created_at DATETIME NOT NULL,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE TABLE assignment_submissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  assignment_id INT NOT NULL,
  student_id INT NOT NULL,
  answers_json JSON,
  status ENUM('Pending','Submitted','Graded') NOT NULL DEFAULT 'Pending',
  marks VARCHAR(20),
  submitted_at DATETIME,
  UNIQUE KEY uniq_assignment_student (assignment_id, student_id),
  FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------
-- Quizzes / Online Tests
-- ---------------------------------------------------------
CREATE TABLE quizzes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NOT NULL,
  title VARCHAR(180) NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 30,
  total_marks INT NOT NULL DEFAULT 100,
  created_at DATETIME NOT NULL,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE TABLE questions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  quiz_id INT NOT NULL,
  question_text TEXT NOT NULL,
  question_type ENUM('mcq','numerical') NOT NULL DEFAULT 'mcq',
  options_json JSON,               -- e.g. ["3","5","15","25"] for MCQ
  correct_answer VARCHAR(255) NOT NULL,   -- option index or numeric value
  marks INT NOT NULL DEFAULT 1,
  position INT NOT NULL DEFAULT 0,
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
);

CREATE TABLE quiz_attempts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  quiz_id INT NOT NULL,
  student_id INT NOT NULL,
  score INT NOT NULL,
  percentage INT NOT NULL,
  grade VARCHAR(5) NOT NULL,
  attempt_number INT NOT NULL DEFAULT 1,
  submitted_at DATETIME NOT NULL,
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------
-- Class Schedule
-- ---------------------------------------------------------
CREATE TABLE schedule (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NOT NULL,
  class_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  lesson_title VARCHAR(180),
  online_link VARCHAR(500),
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------
-- Announcements
-- ---------------------------------------------------------
CREATE TABLE announcements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  body TEXT NOT NULL,
  type VARCHAR(30) DEFAULT 'Notice',
  created_at DATETIME NOT NULL
);

-- ---------------------------------------------------------
-- Realistic sample data so the site can be tested immediately
-- ---------------------------------------------------------
INSERT INTO courses (name, grade, description, created_at) VALUES
('Mathematics', 'Grade 11', 'Full O/L syllabus: algebra, geometry, mensuration and past-paper practice.', NOW()),
('Mathematics', 'Grade 10', 'Foundations for O/L: number, algebra and geometry.', NOW()),
('Mathematics', 'Grade 9', 'Core algebra and geometry topics with past-paper exposure.', NOW());

INSERT INTO announcements (title, body, type, created_at) VALUES
('Welcome to Irzz.Maths.LK', 'Registration is now open for all grades. Contact 078 294 4774 for enrolment.', 'Notice', NOW());

-- Note: student and teacher accounts are created via the app
-- (registration flow) and scripts/create-admin.js — not seeded here,
-- since their passwords must go through bcrypt hashing in Node.
