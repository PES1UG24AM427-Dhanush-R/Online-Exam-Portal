-- Online Exam Portal — Database Schema
-- Run this file once to set up the database before starting the server.

CREATE DATABASE IF NOT EXISTS online_exam_portal
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE online_exam_portal;

-- ─────────────────────────────────────────────
-- users
-- Stores all user accounts for all three roles.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name       VARCHAR(100)  NOT NULL,
  email           VARCHAR(255)  NOT NULL UNIQUE,
  password_hash   VARCHAR(255)  NOT NULL,
  role            ENUM('Student', 'Teacher', 'Admin') NOT NULL DEFAULT 'Student',
  is_active       TINYINT(1)    NOT NULL DEFAULT 1,
  failed_attempts TINYINT       NOT NULL DEFAULT 0,
  lockout_until   DATETIME      NULL,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_role  (role)
);

-- ─────────────────────────────────────────────
-- questions
-- Stores all questions in the question bank.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS questions (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  type           ENUM('MCQ_single', 'MCQ_multiple', 'TrueFalse', 'ShortAnswer') NOT NULL,
  text           TEXT          NOT NULL,
  options        JSON          NULL,       -- array of option strings (MCQ/TrueFalse only)
  correct_answer JSON          NOT NULL,   -- string or array of strings
  subject        VARCHAR(100)  NOT NULL,
  topic          VARCHAR(100)  NOT NULL,
  difficulty     ENUM('Easy', 'Medium', 'Hard') NOT NULL,
  created_by     INT UNSIGNED  NOT NULL,   -- Teacher user id
  created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_subject    (subject),
  INDEX idx_topic      (topic),
  INDEX idx_difficulty (difficulty),
  INDEX idx_created_by (created_by)
);

-- ─────────────────────────────────────────────
-- exams
-- Stores exam definitions created by Teachers.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exams (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title            VARCHAR(255)  NOT NULL,
  duration_minutes INT UNSIGNED  NOT NULL,
  start_datetime   DATETIME      NOT NULL,
  end_datetime     DATETIME      NOT NULL,
  shuffle          TINYINT(1)    NOT NULL DEFAULT 0,
  status           ENUM('draft', 'published', 'closed') NOT NULL DEFAULT 'draft',
  created_by       INT UNSIGNED  NOT NULL,   -- Teacher user id
  created_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_status     (status),
  INDEX idx_window     (start_datetime, end_datetime),
  INDEX idx_created_by (created_by)
);

-- ─────────────────────────────────────────────
-- exam_questions
-- Junction table: maps questions to exams with marks.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exam_questions (
  exam_id     INT UNSIGNED NOT NULL,
  question_id INT UNSIGNED NOT NULL,
  marks       DECIMAL(5,2) NOT NULL DEFAULT 1.00,
  PRIMARY KEY (exam_id, question_id),
  FOREIGN KEY (exam_id)     REFERENCES exams(id)     ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE RESTRICT
);

-- ─────────────────────────────────────────────
-- attempts
-- One row per student per exam attempt.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attempts (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id   INT UNSIGNED NOT NULL,
  exam_id      INT UNSIGNED NOT NULL,
  start_time   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  submitted_at DATETIME     NULL,
  status       ENUM('in_progress', 'submitted', 'timed_out') NOT NULL DEFAULT 'in_progress',
  total_score  DECIMAL(6,2) NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_student_exam (student_id, exam_id),   -- prevents duplicate submissions (OEP-F-015)
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (exam_id)    REFERENCES exams(id) ON DELETE RESTRICT,
  INDEX idx_student_id (student_id),
  INDEX idx_exam_id    (exam_id)
);

-- ─────────────────────────────────────────────
-- answers
-- Stores each student's answer per question per attempt.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS answers (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  attempt_id   INT UNSIGNED NOT NULL,
  question_id  INT UNSIGNED NOT NULL,
  response     TEXT         NULL,
  auto_score   DECIMAL(5,2) NULL,
  manual_score DECIMAL(5,2) NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_attempt_question (attempt_id, question_id),
  FOREIGN KEY (attempt_id)  REFERENCES attempts(id)  ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE RESTRICT,
  INDEX idx_attempt_id (attempt_id)
);

-- ─────────────────────────────────────────────
-- audit_logs
-- Records all critical actions for security audit trail (OEP-SR-003).
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NULL,           -- NULL for unauthenticated actions
  action     VARCHAR(100) NOT NULL,
  ip_address VARCHAR(45)  NOT NULL,       -- supports IPv6
  metadata   JSON         NULL,           -- optional extra context (exam_id, attempt_id, etc.)
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id    (user_id),
  INDEX idx_action     (action),
  INDEX idx_created_at (created_at)
);

-- ─────────────────────────────────────────────
-- token_denylist
-- Stores invalidated JWT tokens (OEP-SR-003).
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS token_denylist (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  token            TEXT         NOT NULL,
  invalidated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at       DATETIME     NOT NULL,   -- used to purge expired entries
  INDEX idx_expires_at (expires_at)
);

-- ─────────────────────────────────────────────
-- password_reset_tokens
-- Single-use tokens for password reset (OEP-F-005).
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  token      VARCHAR(255) NOT NULL UNIQUE,
  expires_at DATETIME     NOT NULL,
  used       TINYINT(1)   NOT NULL DEFAULT 0,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_token      (token),
  INDEX idx_expires_at (expires_at)
);

-- ─────────────────────────────────────────────
-- results_released
-- Tracks which exams have had results released by the Teacher (OEP-F-018).
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS results_released (
  exam_id     INT UNSIGNED NOT NULL PRIMARY KEY,
  released_by INT UNSIGNED NOT NULL,
  released_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (exam_id)     REFERENCES exams(id)  ON DELETE CASCADE,
  FOREIGN KEY (released_by) REFERENCES users(id)  ON DELETE RESTRICT
);
