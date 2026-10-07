# Online Exam Portal

A web-based platform for educational institutions to create, schedule, administer, and evaluate exams online.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Team Members & Roles](#team-members--roles)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation & Setup](#installation--setup)
- [Default Login Credentials](#default-login-credentials)
- [Account Creation](#account-creation)
- [Project Structure](#project-structure)
- [Documentation Links](#documentation-links)
- [Known Limitations](#known-limitations)

---

## Project Overview

The **Online Exam Portal** is a scalable, secure, three-tier web application designed to digitize and streamline the full examination lifecycle for educational organizations. It provides dedicated features for three distinct user roles:

- **Student:** View scheduled exams, attempt exams within strictly enforced time windows with server-authoritative countdown timers, auto-save progress every 60 seconds, submit attempts, and view released results.
- **Teacher:** Create and manage questions in a centralized question bank, build and schedule exams, review student submissions, perform manual grading for short-answer questions, and release exam results.
- **Admin:** Manage user accounts across all roles (Student, Teacher, Admin), monitor active exam sessions, view system audit logs, and oversee portal health.

---

## Team Members & Roles

| Name | Role | Deliverables & Responsibilities |
|---|---|---|
| **Dhanush R** | Person 1 | Software Requirements Specification (SRS), Core Frontend & Backend Modules |
| **Sumit Nagaraj Bali** | Person 2 | Software Architecture and Design Specification (SAD), System Architecture & Database Design |
| **Person 3** | Person 3 | Software Test Plan (STP), Test Strategy & Quality Assurance Specification |
| **Person 4** | Person 4 | Project README, API Documentation (`API_DOCS.md`), and Deployment Guide (`DEPLOYMENT.md`) |

---

## Tech Stack

- **Frontend:** HTML, CSS, JavaScript (Vanilla JS, single-page and multi-page routing)
- **Backend:** Node.js + Express.js
- **Database:** MySQL
- **Authentication & Security:** JWT (HttpOnly cookie), bcrypt (cost factor 12), CSRF protection middleware
- **Email Services:** Nodemailer (SMTP)
- **Communication Protocol:** HTTPS / TLS 1.2+

---

## Prerequisites

Ensure the following software is installed on your environment before proceeding with installation:

- **Node.js:** v18.0.0 or higher
- **MySQL:** v5.7 or higher (or MariaDB 10.3+)
- **npm:** v9.0.0 or higher

---

## Installation & Setup

Follow these steps to set up and run the Online Exam Portal locally:

### 1. Clone the Repository

```bash
git clone <repository-url>
cd Online-Exam-Portal
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Copy the example environment configuration file to create `.env`:

```bash
cp .env.example .env
```

Open `.env` and populate the environment variables according to your local configuration:

```env
PORT=3000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=online_exam_portal
JWT_SECRET=your_super_secret_jwt_key_at_least_32_characters_long
JWT_EXPIRY=30m
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=you@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM=noreply@oep.com
APP_URL=http://localhost:3000
```

### 4. Database Setup

Create the MySQL database and execute the database schema file `backend/database/schema.sql`:

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS online_exam_portal;"
mysql -u root -p online_exam_portal < backend/database/schema.sql
```

Alternatively, run the SQL commands in `backend/database/schema.sql` via MySQL Workbench or any preferred SQL client.

### 5. Run the Application

Start the server in development mode:

```bash
npm start
```

The application will be accessible in your web browser at `http://localhost:3000`.

---

## Default Login Credentials

Upon initial database schema setup, the system is configured with a default Admin account:

| Role | Email | Password |
|---|---|---|
| **Admin** | `admin@oep.com` | `Admin@123` |

> **Security Note:** It is strongly recommended to update the default Admin password immediately after initial setup in production environments.

---

## Account Creation

User accounts for **Teacher** and **Student** roles can be created through two methods:

1. **Admin User Management:** Log in with an **Admin** account, navigate to the Admin Dashboard (`/admin/dashboard.html`), and create new users with assigned roles (`Student`, `Teacher`, or `Admin`).
2. **Public Self-Registration:** Users can self-register via the registration page (`/register.html`).

---

## Project Structure

```
Online-Exam-Portal/
├── backend/
│   ├── server.js
│   ├── config/db.js
│   ├── middleware/
│   │   ├── auth.js
│   │   ├── rbac.js
│   │   ├── validate.js
│   │   └── csrf.js
│   ├── modules/
│   │   ├── auth/
│   │   ├── questionBank/
│   │   ├── exam/
│   │   ├── examTaking/
│   │   ├── grading/
│   │   └── admin/
│   └── database/schema.sql
├── frontend/
│   ├── index.html
│   ├── register.html
│   ├── forgot-password.html
│   ├── reset-password.html
│   ├── student/
│   │   ├── dashboard.html
│   │   └── exam.html
│   ├── teacher/
│   │   ├── dashboard.html
│   │   ├── questions.html
│   │   ├── exams.html
│   │   └── grading.html
│   └── admin/
│       └── dashboard.html
├── SRS_OnlineExamPortal.md
├── SAD_OnlineExamPortal.md
├── STP_OnlineExamPortal.md
├── package.json
├── .env.example
└── .gitignore
```

---

## Documentation Links

Complete specification documents for the project are available in the repository root:

- [Software Requirements Specification (SRS)](./SRS_OnlineExamPortal.md)
- [Software Architecture and Design Specification (SAD)](./SAD_OnlineExamPortal.md)
- [Software Test Plan (STP)](./STP_OnlineExamPortal.md)
- [API Documentation (API_DOCS.md)](./API_DOCS.md)
- [Deployment Guide (DEPLOYMENT.md)](./DEPLOYMENT.md)

---

## Known Limitations

The following features are outside the scope of version 1.0 (v1.0):

- **No Video Proctoring:** Automatic webcam, microphone, or AI-based proctoring and facial recognition are not supported in v1.0.
- **No Mobile Application:** There is no dedicated native mobile app (iOS/Android) in v1.0; access is via desktop web browsers.
- **No PDF Export:** Exporting exam question sets, student scorecards, or analytical reports to PDF format is not supported in v1.0.
