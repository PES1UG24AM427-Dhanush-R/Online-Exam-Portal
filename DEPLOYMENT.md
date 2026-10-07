# Deployment Guide — Online Exam Portal

This guide provides comprehensive instructions for deploying, configuring, maintaining, and troubleshooting the **Online Exam Portal** in both local development and production environments.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Variables Reference](#environment-variables-reference)
- [Step-by-Step Setup](#step-by-step-setup)
  - [1. Repository & Dependencies](#1-repository--dependencies)
  - [2. Environment File Setup](#2-environment-file-setup)
  - [3. Running the Database Schema](#3-running-the-database-schema)
  - [4. Creating the First Admin Account](#4-creating-the-first-admin-account)
- [Starting the Server](#starting-the-server)
  - [Development Mode](#development-mode)
  - [Production Mode](#production-mode)
- [Common Errors & Troubleshooting](#common-errors--troubleshooting)
- [Out of Scope / Not Implemented in v1.0](#out-of-scope--not-implemented-in-v10)

---

## Prerequisites

The target deployment host must satisfy the following software requirements:

| Component | Exact Required Version | Recommended Notes |
|---|---|---|
| **Node.js** | `v18.0.0` or higher | Node.js 18 LTS or Node.js 20 LTS |
| **MySQL** | `v5.7` or higher (or MariaDB 10.3+) | `utf8mb4` character set support required |
| **npm** | `v9.0.0` or higher | Included with Node.js 18+ |

---

## Environment Variables Reference

All runtime configurations are specified using environment variables defined in a `.env` file at the root of the project.

| Variable | Description | Example Value |
|---|---|---|
| `PORT` | Port the server runs on | `3000` |
| `NODE_ENV` | Environment mode | `development` |
| `DB_HOST` | MySQL host | `localhost` |
| `DB_PORT` | MySQL port | `3306` |
| `DB_USER` | MySQL username | `root` |
| `DB_PASSWORD` | MySQL password | `yourpassword` |
| `DB_NAME` | Database name | `online_exam_portal` |
| `JWT_SECRET` | Secret key for signing JWTs (min 32 chars) | `some_long_random_string` |
| `JWT_EXPIRY` | JWT token expiry time | `30m` |
| `EMAIL_HOST` | SMTP host | `smtp.gmail.com` |
| `EMAIL_PORT` | SMTP port | `587` |
| `EMAIL_USER` | SMTP email address | `you@gmail.com` |
| `EMAIL_PASS` | SMTP app password | `your_app_password` |
| `EMAIL_FROM` | Sender address shown in emails | `noreply@oep.com` |
| `APP_URL` | Base URL of the app | `http://localhost:3000` |

> **Security Alert:** Never commit `.env` to version control. Ensure `.env` is listed in `.gitignore`.

---

## Step-by-Step Setup

### 1. Repository & Dependencies

Clone the project repository and install required Node.js dependencies:

```bash
git clone <repository-url>
cd Online-Exam-Portal
npm install
```

### 2. Environment File Setup

Copy `.env.example` to create `.env`:

```bash
cp .env.example .env
```

Open `.env` in your editor and update the database host, user credentials, JWT secret, and SMTP settings matching your environment.

### 3. Running the Database Schema

Log in to MySQL and create the database `online_exam_portal`:

```sql
CREATE DATABASE IF NOT EXISTS online_exam_portal CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Run the schema SQL script `backend/database/schema.sql`:

```bash
mysql -u root -p online_exam_portal < backend/database/schema.sql
```

Using MySQL Workbench or phpMyAdmin:
1. Open `backend/database/schema.sql`.
2. Execute the entire SQL script within your MySQL instance.

### 4. Creating the First Admin Account

The system requires an initial **Admin** user account to manage users and system configuration.

Default initial credentials for the first Admin account:

- **Role:** Admin
- **Email:** `admin@oep.com`
- **Password:** `Admin@123`

To manually seed this initial Admin account into MySQL if not present, run the following SQL script in your database prompt:

```sql
USE online_exam_portal;

INSERT INTO users (full_name, email, password_hash, role, is_active)
VALUES (
  'System Admin',
  'admin@oep.com',
  '$2b$12$e8rX2Lg6w.z8e.sX... (bcrypt hash for Admin@123)',
  'Admin',
  1
) ON DUPLICATE KEY UPDATE email = email;
```

Subsequent **Teacher** and **Student** accounts can be registered via the registration page (`/register.html`) or created by an **Admin** via the Admin Dashboard (`/admin/dashboard.html` or `POST /api/admin/users`).

---

## Starting the Server

### Development Mode

To run the application with development logs and automatic reloads:

```bash
npm start
```

Alternatively, launch directly via Node.js:

```bash
node backend/server.js
```

The application will listen at `http://localhost:3000`.

### Production Mode

In production environments, ensure process managers (such as PM2 or systemd) are used to manage the Node.js process and handle automatic restarts upon failure or reboot.

#### Using PM2:

1. Install PM2 globally:
   ```bash
   npm install -g pm2
   ```

2. Start the application under PM2:
   ```bash
   NODE_ENV=production pm2 start backend/server.js --name "online-exam-portal"
   ```

3. Save process state and set up PM2 auto-start on boot:
   ```bash
   pm2 save
   pm2 startup
   ```

4. Reverse Proxy Setup: Place Nginx or Apache in front of Node.js to terminate TLS (HTTPS) and route requests to `http://127.0.0.1:3000`.

---

## Common Errors & Troubleshooting

### 1. Database Connection Refused (`ECONNREFUSED` / `ER_ACCESS_DENIED_ERROR`)

- **Symptoms:** Server crashes on startup or health check returns `{"status":"degraded","message":"Database unreachable"}`.
- **Cause:** Incorrect `DB_HOST`, `DB_PORT`, `DB_USER`, or `DB_PASSWORD` in `.env`, or MySQL service is stopped.
- **Solution:**
  1. Verify MySQL service is active (`systemctl status mysql` or check Windows Services).
  2. Verify credentials by manually testing connection: `mysql -h localhost -u root -p`.
  3. Ensure `.env` values match your MySQL server configuration.

### 2. Port Already in Use (`EADDRINUSE: address already in use :::3000`)

- **Symptoms:** Server fails to launch with `Error: listen EADDRINUSE: address already in use :::3000`.
- **Cause:** Another process is already running on port 3000.
- **Solution:**
  - Find and stop the process using port 3000:
    - **Linux/macOS:** `lsof -i :3000` followed by `kill -9 <PID>`
    - **Windows:** `netstat -ano | findstr :3000` followed by `taskkill /F /PID <PID>`
  - Alternatively, change `PORT` in `.env` to a different available port (e.g., `PORT=3001`).

### 3. Unknown Database (`ER_BAD_DB_ERROR`)

- **Symptoms:** `Error: Unknown database 'online_exam_portal'`.
- **Cause:** The database was not created prior to launching the server.
- **Solution:** Execute `CREATE DATABASE online_exam_portal;` in MySQL before starting the backend.

### 4. Invalid CSRF Token (`INVALID_CSRF_TOKEN` / HTTP 403)

- **Symptoms:** State-modifying requests (`POST`, `PUT`, `DELETE`) fail with `HTTP 403 Forbidden` and message `"Form submission could not be verified."`.
- **Cause:** Client failed to request `/api/auth/csrf-token` or omitted the `x-csrf-token` header.
- **Solution:** Ensure the frontend fetches a valid CSRF token from `GET /api/auth/csrf-token` prior to submitting forms and attaches `x-csrf-token` in headers.

### 5. Email Delivery Failures / SMTP Errors

- **Symptoms:** Password reset emails are not received or `forgotPassword` throws an error.
- **Cause:** Incorrect SMTP credentials or port blocking by ISP/firewall.
- **Solution:**
  1. For Gmail SMTP (`smtp.gmail.com`), generate and use an **App Password** instead of your personal password.
  2. Verify `EMAIL_PORT=587` (TLS) or `465` (SSL).

---

## Out of Scope / Not Implemented in v1.0

The following capabilities are explicitly outside the scope of **Online Exam Portal v1.0**:

- **Video Proctoring:** No AI-based proctoring, webcam monitoring, screen recording, or facial recognition.
- **PDF Export:** No automated generation or export of scorecards, exam questions, or analytical summary reports into PDF files.
- **Mobile Application:** No native iOS or Android mobile application (supported via modern mobile/desktop web browsers).
- **LMS Integration:** No integration with external Learning Management Systems (LMS) such as Canvas, Moodle, or Blackboard via LTI standards.
