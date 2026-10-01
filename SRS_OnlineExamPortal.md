# Software Requirements Specification (SRS)

**Project:** Online Exam Portal  
**Version:** 1.0  
**Authors:** [Your Name]  
**Date:** 29-09-2026  
**Status:** Draft  

---

## Revision History

| Version | Date | Author | Change Summary | Approval |
|---|---|---|---|---|
| 1.0 | 29-09-2026 | [Your Name] | Initial SRS draft | Pending |

---

## Approvals

| Role | Name | Signature / Email | Date |
|---|---|---|---|
| Course Coordinator | | | |
| Project Lead | | | |

---

## Table of Contents

1. Introduction
2. Overall Description
3. External Interface Requirements
4. System Features (Detailed)
5. Non-Functional Requirements (Detailed)
6. Quality Attributes & Acceptance Tests
7. UML Use-Case Diagrams
8. Requirements Traceability Matrix (RTM)

---

## 1. Introduction

### 1.1 Purpose

This document is a Software Requirements Specification (SRS) for the Online Exam Portal system. It defines the functional requirements, non-functional requirements, security requirements, system interfaces, and verification criteria for the platform. It serves as the primary reference document for developers, designers, QA engineers, and academic evaluators involved in this project.

### 1.2 Scope

The Online Exam Portal is a web-based platform that enables educational institutions to create, schedule, administer, and evaluate examinations entirely online. The system supports three user roles — Student, Teacher, and Admin — each with distinct capabilities.

**In scope:**
- Student registration, login, and profile management
- Exam creation and question bank management by Teachers
- Exam scheduling, access control, and timer enforcement
- Automated grading for objective questions (MCQ, True/False)
- Manual grading support for descriptive/essay questions
- Results generation, report cards, and performance analytics
- Admin control over users, exams, and system configuration
- Secure session management and anti-cheating measures

**Out of scope:**
- Video proctoring or AI-based cheating detection
- Integration with third-party LMS platforms (e.g., Moodle, Canvas)
- Mobile native applications (iOS/Android)
- Payment processing for exam fees

### 1.3 Audience

- **Developers:** For implementing system features and APIs
- **QA Engineers:** For writing and executing test cases
- **System Architects:** For designing components and data models
- **Instructors / Evaluators:** For assessing project completeness and correctness
- **Project Team Members:** As a shared reference throughout development

### 1.4 Definitions

| Term | Definition |
|---|---|
| OEP | Online Exam Portal — the system being specified in this document |
| Student | A registered user who takes exams |
| Teacher | A registered user who creates and manages exams and questions |
| Admin | A privileged user who manages the platform, users, and system settings |
| MCQ | Multiple Choice Question — a question with one or more correct options |
| FR | Functional Requirement |
| NFR | Non-Functional Requirement |
| SR | Security Requirement |
| RTM | Requirements Traceability Matrix |
| UI | User Interface |
| API | Application Programming Interface |
| JWT | JSON Web Token — used for session authentication |
| TLS | Transport Layer Security — protocol for encrypting data in transit |
| RBAC | Role-Based Access Control |
| SRS | Software Requirements Specification |
| UAT | User Acceptance Testing |

---

## 2. Overall Description

### 2.1 Product Perspective

The Online Exam Portal is a standalone web application designed to replace paper-based and in-person examinations with a digital, scalable, and secure alternative. It operates as a three-tier system:

- **Presentation layer:** A web-based UI accessible via any modern browser
- **Application layer:** A server-side backend handling business logic, authentication, exam management, and grading
- **Data layer:** A relational database storing user data, questions, exams, submissions, and results

The system does not depend on any external LMS but is designed to be extensible for future integrations.

### 2.2 Major Product Functions

- **User Authentication & Role Management:** Secure login for Student, Teacher, and Admin with RBAC
- **Question Bank Management:** Teachers create, edit, categorize, and reuse questions
- **Exam Creation & Scheduling:** Teachers define exam parameters (duration, marks, access window, shuffle options)
- **Exam Taking:** Students access and submit exams within the allowed time window with timer enforcement
- **Auto-Grading:** System automatically scores MCQ and True/False questions upon submission
- **Manual Grading:** Teachers review and grade descriptive answers with a scoring interface
- **Results & Analytics:** Students view their results; Teachers view class-wide performance reports
- **Admin Dashboard:** Manage users, monitor active exams, configure system-level settings
- **Notifications:** Email or in-app alerts for exam schedules, results publication, and account events
- **Audit Logging:** System records all critical actions for security and accountability

### 2.3 User Roles and Characteristics

| Role | Description | Technical Proficiency |
|---|---|---|
| **Student** | Registers, logs in, views scheduled exams, takes exams, views results | Low to medium — expects a simple, intuitive interface |
| **Teacher** | Creates question banks, designs exams, schedules them, grades submissions, views analytics | Medium — comfortable with form-based web tools |
| **Admin** | Manages all users and their roles, monitors system activity, configures global settings | High — has full system access and understands platform configuration |

### 2.4 Operating Environment

- **Client side:** Any modern web browser (Chrome, Firefox, Edge, Safari) on desktop or laptop
- **Server side:** Linux-based server (cloud or on-premise)
- **Database:** Relational database (e.g., MySQL or PostgreSQL)
- **Network:** Requires stable internet connection; HTTPS enforced for all communication
- **Session handling:** JWT-based authentication with configurable expiry

### 2.5 Constraints

- All communication must be over TLS 1.2 or higher
- Passwords must be stored as salted hashes — never in plaintext
- The system must enforce role-based access at every API endpoint
- Exam submissions must be locked once the timer expires — no late submissions accepted
- The system must handle at least 100 concurrent students taking exams without degraded performance

---

## 3. External Interface Requirements

### 3.1 User Interfaces

- **Student Dashboard:** Lists upcoming and past exams, results, and notifications
- **Exam Interface:** Displays questions one at a time or all at once (configurable by Teacher), with a visible countdown timer and a submission button
- **Teacher Dashboard:** Provides access to question bank, exam management, grading queue, and analytics
- **Admin Dashboard:** Shows user management, active exam monitoring, and system configuration panels
- **Accessibility:** All UI screens must have sufficient color contrast, keyboard-navigable elements, and screen-reader compatible labels conforming to WCAG 2.1 AA guidelines

### 3.2 Hardware Interfaces

The Online Exam Portal is a pure software system and has no direct hardware interface dependencies. It runs on standard web server hardware and is accessed via client devices (laptops, desktops) with a keyboard, mouse, and display.

### 3.3 Software Interfaces

| Interface | Purpose |
|---|---|
| **Web Browser** | Client-side rendering of the portal UI via HTML/CSS/JavaScript |
| **Backend REST API** | All client-server communication goes through RESTful JSON APIs over HTTPS |
| **Relational Database** | Persistent storage for users, questions, exams, submissions, results, and logs |
| **Email Service (SMTP/API)** | Sending exam schedule notifications and result alerts to Students and Teachers |
| **Authentication Service** | JWT generation, validation, and refresh for session management |

### 3.4 Communications

- All data exchange between client and server must use HTTPS (TLS 1.2+)
- REST API responses must follow standard HTTP status codes (200, 400, 401, 403, 404, 500)
- JWT tokens must be transmitted via HTTP Authorization headers (Bearer scheme) — never in URL query parameters
- Sensitive data (passwords, answers during submission) must never be logged in plaintext
- Session tokens must expire after a configurable idle period (default: 30 minutes)

---

## 4. System Features (Detailed)

> Each requirement includes an ID, description, type, priority, stakeholder, acceptance criteria, and test case reference.  
> IDs follow the format: `OEP-F-###`  
> At least 15 functional requirements are specified across all features.

---

### 4.1 User Authentication & Account Management

**Description:** The system must allow Students, Teachers, and Admins to register and securely log in. Access to all features must be gated behind authentication and role-based authorization.

| Req ID | Requirement | Type | Priority | Source / Stakeholder | Acceptance Criteria / Test Case Ref | Comments / Dependencies |
|---|---|---|---|---|---|---|
| OEP-F-001 | The system shall allow new Students to register with a unique email address, a full name, and a password. | Functional | High | Student | AC: Registration succeeds with valid unique email; duplicate email returns an error. Test: TC-Auth-01 | Password must be hashed before storage |
| OEP-F-002 | The system shall authenticate users (Student, Teacher, Admin) via email and password and issue a JWT upon successful login. | Functional | High | All roles | AC: Valid credentials return a JWT; invalid credentials return HTTP 401. Test: TC-Auth-02 | JWT must include role claim |
| OEP-F-003 | The system shall lock a user account for 15 minutes after 5 consecutive failed login attempts and notify the user via email. | Functional | High | Security | AC: 6th failed attempt is rejected with lockout message; account unlocks after 15 minutes. Test: TC-Auth-03 | Lockout count resets on successful login |
| OEP-F-004 | The system shall enforce role-based access control so that Students cannot access Teacher or Admin endpoints, and Teachers cannot access Admin-only endpoints. | Functional | High | Admin / Security | AC: Unauthorized role access returns HTTP 403. Test: TC-Auth-04 | RBAC must be enforced server-side, not just UI-level |
| OEP-F-005 | The system shall allow users to reset their password via a time-limited (1 hour) email link. | Functional | Medium | Student / Teacher | AC: Valid reset link allows password change; expired link returns an error. Test: TC-Auth-05 | Reset token must be single-use |

---

### 4.2 Question Bank Management

**Description:** Teachers must be able to create, organize, and manage a reusable bank of questions categorized by subject, topic, and difficulty level.

| Req ID | Requirement | Type | Priority | Source / Stakeholder | Acceptance Criteria / Test Case Ref | Comments / Dependencies |
|---|---|---|---|---|---|---|
| OEP-F-006 | The system shall allow Teachers to create questions of the following types: Multiple Choice (single correct), Multiple Choice (multiple correct), True/False, and Short Answer. | Functional | High | Teacher | AC: All four question types can be saved and retrieved correctly. Test: TC-QB-01 | Question must store type, text, options (if any), and correct answer |
| OEP-F-007 | The system shall allow Teachers to tag each question with a subject, topic, and difficulty level (Easy, Medium, Hard). | Functional | Medium | Teacher | AC: Questions can be filtered and searched by these tags. Test: TC-QB-02 | Tags are used for question selection during exam creation |
| OEP-F-008 | The system shall allow Teachers to edit or delete questions from the question bank, provided the question is not part of an active or upcoming exam. | Functional | Medium | Teacher | AC: Editing a question not in use saves changes; attempting to edit a question in an active exam returns an error. Test: TC-QB-03 | Protects integrity of ongoing exams |

---

### 4.3 Exam Creation & Scheduling

**Description:** Teachers must be able to compose exams from their question bank, configure exam parameters, and schedule them for a specific time window.

| Req ID | Requirement | Type | Priority | Source / Stakeholder | Acceptance Criteria / Test Case Ref | Comments / Dependencies |
|---|---|---|---|---|---|---|
| OEP-F-009 | The system shall allow Teachers to create an exam by selecting questions from the question bank and assigning marks to each question. | Functional | High | Teacher | AC: Exam is saved with correct question list and mark allocations. Test: TC-Exam-01 | Total marks auto-calculated |
| OEP-F-010 | The system shall allow Teachers to configure exam settings including: duration (in minutes), start datetime, end datetime, and whether question order is randomized. | Functional | High | Teacher | AC: All configured settings are enforced when the exam runs. Test: TC-Exam-02 | Start/end window controls when Students can access the exam |
| OEP-F-011 | The system shall allow Teachers to publish an exam, making it visible and accessible to enrolled Students within the configured time window. | Functional | High | Teacher | AC: Published exam appears on Student dashboard only after start datetime. Test: TC-Exam-03 | Unpublished exams are not visible to Students |

---

### 4.4 Exam Taking

**Description:** Students must be able to access, attempt, and submit exams within the allowed window. The system must enforce the timer and prevent late submissions.

| Req ID | Requirement | Type | Priority | Source / Stakeholder | Acceptance Criteria / Test Case Ref | Comments / Dependencies |
|---|---|---|---|---|---|---|
| OEP-F-012 | The system shall display a countdown timer to the Student during an exam and automatically submit the exam when the timer reaches zero. | Functional | High | Student | AC: Timer is visible at all times; auto-submission occurs at time zero with all answered questions saved. Test: TC-Take-01 | Timer must sync with server time, not client time |
| OEP-F-013 | The system shall prevent a Student from accessing an exam before the scheduled start time or after the scheduled end time. | Functional | High | Student / Teacher | AC: Attempting to access an exam outside its window returns an access denied message. Test: TC-Take-02 | Server-side enforcement required |
| OEP-F-014 | The system shall save a Student's answers automatically every 60 seconds during an ongoing exam to prevent data loss. | Functional | High | Student | AC: If the browser closes and the Student re-opens the exam (within the time window), previously answered questions are restored. Test: TC-Take-03 | Auto-save must not reset the timer |
| OEP-F-015 | The system shall prevent a Student from submitting an exam more than once. | Functional | High | Student / Teacher | AC: Second submission attempt returns an error; first submission is preserved. Test: TC-Take-04 | Submission record is created on first submit |

---

### 4.5 Grading & Results

**Description:** The system must automatically grade objective questions and provide Teachers with an interface to manually grade descriptive answers. Results must be published to Students.

| Req ID | Requirement | Type | Priority | Source / Stakeholder | Acceptance Criteria / Test Case Ref | Comments / Dependencies |
|---|---|---|---|---|---|---|
| OEP-F-016 | The system shall automatically calculate the score for MCQ and True/False questions immediately upon exam submission. | Functional | High | Student / Teacher | AC: Auto-graded score matches the correct answer key with correct mark allocation. Test: TC-Grade-01 | Negative marking (if configured) must also be applied |
| OEP-F-017 | The system shall provide Teachers with a grading interface to review Short Answer responses and assign marks manually. | Functional | High | Teacher | AC: Teacher can view each Student's response, enter a score within the allowed range, and save it. Test: TC-Grade-02 | Results not published until all manual grading is complete |
| OEP-F-018 | The system shall publish results to Students only after the Teacher explicitly marks the exam results as released. | Functional | High | Teacher / Student | AC: Student cannot see their score until Teacher releases results; after release, score is visible on Student dashboard. Test: TC-Grade-03 | |

---

### 4.6 Admin Functions

**Description:** The Admin must have full control over user management, exam oversight, and system configuration.

| Req ID | Requirement | Type | Priority | Source / Stakeholder | Acceptance Criteria / Test Case Ref | Comments / Dependencies |
|---|---|---|---|---|---|---|
| OEP-F-019 | The system shall allow the Admin to create, deactivate, and delete user accounts for any role (Student, Teacher, Admin). | Functional | High | Admin | AC: Deactivated users cannot log in; deleted users are removed from the system. Test: TC-Admin-01 | Deletion must cascade to associated data or anonymize it |
| OEP-F-020 | The system shall provide the Admin with a dashboard showing all currently active exams, number of Students currently taking each exam, and system health indicators. | Functional | Medium | Admin | AC: Dashboard updates in near-real-time (within 30 seconds). Test: TC-Admin-02 | |

---

## 5. Non-Functional Requirements (Detailed)

> IDs follow the format: `OEP-NF-###`

| Req ID | Requirement | Category | Priority | Acceptance Criteria / Measurement |
|---|---|---|---|---|
| OEP-NF-001 | The system shall respond to any user action (page load, form submission, question navigation) within 3 seconds for 95% of requests under a load of 100 concurrent users. | Performance | High | 95th percentile response time ≤ 3s measured via load testing with 100 concurrent users. Test: TC-Perf-01 |
| OEP-NF-002 | The system shall maintain 99.5% uptime per month, excluding scheduled maintenance windows which must be announced at least 24 hours in advance. | Reliability | High | Monthly uptime logs show ≥ 99.5%. Maintenance windows are logged and announced. Test: Ops monitoring reports. |
| OEP-NF-003 | The system shall support at least 200 registered users and 100 concurrent active exam sessions without any data integrity issues or performance degradation beyond the OEP-NF-001 threshold. | Scalability | High | Load test with 100 concurrent exam sessions shows no failed submissions or data corruption. Test: TC-Perf-02 |
| OEP-NF-004 | All user-facing error messages shall be clear, non-technical, and must not expose internal system details such as stack traces, database errors, or file paths. | Usability | High | Manual review of all error scenarios confirms no sensitive system info is exposed. Test: TC-UX-01 |
| OEP-NF-005 | The system shall conform to WCAG 2.1 Level AA accessibility guidelines, including sufficient color contrast ratios, keyboard navigability, and ARIA labels for all interactive elements. | Accessibility | Medium | Accessibility audit using automated tools (e.g., axe) and manual review passes AA criteria. Test: TC-UX-02 |

---

### 5.1 Security

#### 5.1.1 Security Objectives

1. **Protect the confidentiality and integrity of exam content** — Exam questions and answers must not be accessible to unauthorized users at any time, including before, during, or after the exam.

2. **Ensure authentication and authorization integrity** — Only authenticated users with the correct role must be able to access system features. No user must be able to escalate their privileges or impersonate another user.

#### 5.1.2 Security Requirements

> IDs follow the format: `OEP-SR-###`

| Req ID | Requirement | Type | Priority | Acceptance Criteria / Test Case Ref |
|---|---|---|---|---|
| OEP-SR-001 | The system shall enforce HTTPS (TLS 1.2 or higher) for all client-server communication. HTTP requests must be automatically redirected to HTTPS. | Security | High | Verified using a TLS scanner; HTTP access returns 301 redirect to HTTPS. Test: TC-Sec-01 |
| OEP-SR-002 | The system shall store all user passwords as salted hashes using a strong hashing algorithm (e.g., bcrypt with a minimum cost factor of 10). Plaintext passwords must never be stored or logged. | Security | High | Database inspection confirms no plaintext passwords; log files contain no password values. Test: TC-Sec-02 |
| OEP-SR-003 | The system shall invalidate a user's JWT session token upon logout and reject any further requests made with that token. | Security | High | After logout, using the old JWT returns HTTP 401. Test: TC-Sec-03 |
| OEP-SR-004 | The system shall validate and sanitize all user inputs on the server side to prevent SQL injection, Cross-Site Scripting (XSS), and other injection attacks. | Security | High | Penetration test inputs (SQL injection strings, XSS payloads) in all form fields return safe error responses, not system errors. Test: TC-Sec-04 |
| OEP-SR-005 | The system shall implement CSRF protection on all state-changing API endpoints (POST, PUT, DELETE) to prevent cross-site request forgery attacks. | Security | High | CSRF token missing or invalid on a state-changing request returns HTTP 403. Test: TC-Sec-05 |

---

## 6. Quality Attributes & Acceptance Tests

### Exit Criteria for Acceptance

The system is considered ready for acceptance when all of the following are satisfied:
- All high-priority functional requirements (OEP-F-001 through OEP-F-020) are implemented and verified
- All high-priority non-functional requirements (OEP-NF-001 through OEP-NF-003) pass their measurement criteria
- All security requirements (OEP-SR-001 through OEP-SR-005) pass their test cases
- The RTM shows 100% of planned test cases executed with no critical (P1) defects open
- UAT sign-off obtained from course coordinator or product owner

### Acceptance Test Suites

| Suite | Requirements Covered | Description |
|---|---|---|
| **Authentication Suite** | OEP-F-001 to OEP-F-005 | Registration, login, lockout, RBAC, password reset |
| **Question Bank Suite** | OEP-F-006 to OEP-F-008 | Question creation, tagging, editing, deletion |
| **Exam Management Suite** | OEP-F-009 to OEP-F-011 | Exam creation, configuration, publishing |
| **Exam Taking Suite** | OEP-F-012 to OEP-F-015 | Timer, access control, auto-save, submission prevention |
| **Grading & Results Suite** | OEP-F-016 to OEP-F-018 | Auto-grading, manual grading, result release |
| **Admin Suite** | OEP-F-019 to OEP-F-020 | User management, admin dashboard |
| **Performance Suite** | OEP-NF-001, OEP-NF-003 | Response time, concurrent user load testing |
| **Security Suite** | OEP-SR-001 to OEP-SR-005 | TLS, password hashing, token invalidation, input validation, CSRF |
| **Accessibility Suite** | OEP-NF-005 | WCAG 2.1 AA compliance |

---

## 7. UML Use-Case Diagrams

> Note: Diagrams are to be created using PlantUML or draw.io and embedded here. Descriptions below define the actors and use cases for each diagram.

---

### 7.1 Use-Case Diagram 1 — Student Exam Flow

**Actors:** Student, System

**Use Cases:**
- Register Account
- Login
- View Exam Schedule
- Start Exam
- Answer Questions (extends: Auto-Save Answers)
- Submit Exam (includes: Timer Auto-Submit)
- View Results (extends: Download Result PDF)
- Reset Password

**Description:** This diagram covers the complete lifecycle of a Student's interaction with the portal — from registration through to viewing their results. The auto-save and timer auto-submit behaviors are shown as extension/inclusion relationships to the core exam-taking use case.

```
[Student] --> (Register Account)
[Student] --> (Login)
[Student] --> (View Exam Schedule)
[Student] --> (Start Exam)
(Start Exam) ..> (Auto-Save Answers) : <<extends>>
(Start Exam) ..> (Timer Auto-Submit) : <<includes>>
[Student] --> (Submit Exam)
[Student] --> (View Results)
(View Results) ..> (Download Result PDF) : <<extends>>
[Student] --> (Reset Password)
```

---

### 7.2 Use-Case Diagram 2 — Teacher & Admin Management Flow

**Actors:** Teacher, Admin, System

**Use Cases (Teacher):**
- Login
- Create Question
- Edit / Delete Question
- Create Exam
- Configure Exam Settings
- Publish Exam
- Grade Short Answer Submissions
- Release Results
- View Class Analytics

**Use Cases (Admin):**
- Login
- Create / Deactivate / Delete User
- Assign Role to User
- Monitor Active Exams
- View System Health Dashboard

**Description:** This diagram covers the management side of the portal. It shows the two privileged roles and their distinct capabilities. The Admin has a separate set of use cases that overlap with user management and system monitoring, while the Teacher focuses on academic content and evaluation.

```
[Teacher] --> (Login)
[Teacher] --> (Create Question)
[Teacher] --> (Edit / Delete Question)
[Teacher] --> (Create Exam)
(Create Exam) ..> (Configure Exam Settings) : <<includes>>
[Teacher] --> (Publish Exam)
[Teacher] --> (Grade Short Answer Submissions)
[Teacher] --> (Release Results)
[Teacher] --> (View Class Analytics)

[Admin] --> (Login)
[Admin] --> (Create / Deactivate / Delete User)
[Admin] --> (Assign Role to User)
[Admin] --> (Monitor Active Exams)
[Admin] --> (View System Health Dashboard)
```

---

## 8. Requirements Traceability Matrix (RTM)

> Status codes: **N** = Not started, **P** = Passed, **F** = Failed, **A** = N/A

| Req ID | Requirement (Short) | Section Ref | Module | Test Case(s) | Status | Comments |
|---|---|---|---|---|---|---|
| OEP-F-001 | Student registration | 4.1 | AuthModule | TC-Auth-01 | N | |
| OEP-F-002 | User login & JWT issuance | 4.1 | AuthModule | TC-Auth-02 | N | |
| OEP-F-003 | Account lockout after 5 failed attempts | 4.1 | AuthModule | TC-Auth-03 | N | |
| OEP-F-004 | Role-based access control enforcement | 4.1 | AuthModule / API Gateway | TC-Auth-04 | N | |
| OEP-F-005 | Password reset via email link | 4.1 | AuthModule | TC-Auth-05 | N | |
| OEP-F-006 | Question creation (4 types) | 4.2 | QuestionBankModule | TC-QB-01 | N | |
| OEP-F-007 | Question tagging by subject/topic/difficulty | 4.2 | QuestionBankModule | TC-QB-02 | N | |
| OEP-F-008 | Question edit / delete (not in active exam) | 4.2 | QuestionBankModule | TC-QB-03 | N | |
| OEP-F-009 | Exam creation from question bank | 4.3 | ExamModule | TC-Exam-01 | N | |
| OEP-F-010 | Exam settings configuration | 4.3 | ExamModule | TC-Exam-02 | N | |
| OEP-F-011 | Exam publishing | 4.3 | ExamModule | TC-Exam-03 | N | |
| OEP-F-012 | Countdown timer & auto-submit | 4.4 | ExamTakingModule | TC-Take-01 | N | |
| OEP-F-013 | Exam access window enforcement | 4.4 | ExamTakingModule | TC-Take-02 | N | |
| OEP-F-014 | Auto-save every 60 seconds | 4.4 | ExamTakingModule | TC-Take-03 | N | |
| OEP-F-015 | Prevent duplicate submission | 4.4 | ExamTakingModule | TC-Take-04 | N | |
| OEP-F-016 | Auto-grading for MCQ / True/False | 4.5 | GradingModule | TC-Grade-01 | N | |
| OEP-F-017 | Manual grading interface for Short Answer | 4.5 | GradingModule | TC-Grade-02 | N | |
| OEP-F-018 | Result release by Teacher | 4.5 | GradingModule | TC-Grade-03 | N | |
| OEP-F-019 | Admin user management | 4.6 | AdminModule | TC-Admin-01 | N | |
| OEP-F-020 | Admin active exam dashboard | 4.6 | AdminModule | TC-Admin-02 | N | |
| OEP-NF-001 | Response time ≤ 3s at 95th percentile | 5 | All | TC-Perf-01 | N | |
| OEP-NF-002 | 99.5% monthly uptime | 5 | Infrastructure | Ops monitoring | N | |
| OEP-NF-003 | 100 concurrent exam sessions | 5 | All | TC-Perf-02 | N | |
| OEP-NF-004 | Safe user-facing error messages | 5 | All | TC-UX-01 | N | |
| OEP-NF-005 | WCAG 2.1 AA accessibility | 5 | UI | TC-UX-02 | N | |
| OEP-SR-001 | HTTPS / TLS 1.2+ enforcement | 5.1.2 | API Gateway | TC-Sec-01 | N | |
| OEP-SR-002 | Password hashing (bcrypt) | 5.1.2 | AuthModule | TC-Sec-02 | N | |
| OEP-SR-003 | JWT invalidation on logout | 5.1.2 | AuthModule | TC-Sec-03 | N | |
| OEP-SR-004 | Input validation / injection prevention | 5.1.2 | All | TC-Sec-04 | N | |
| OEP-SR-005 | CSRF protection on state-changing endpoints | 5.1.2 | API Gateway | TC-Sec-05 | N | |
