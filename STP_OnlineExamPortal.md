# Software Test Plan (STP)
## Online Exam Portal

## 1. Introduction

### 1.1 Purpose

This Software Test Plan (STP) defines the testing approach for the Online Exam Portal. It specifies the testing strategy, test environment, test cases, test schedule, testing roles, risks and mitigations, and requirements traceability needed to verify that the system satisfies the requirements defined in the Software Requirements Specification (SRS).

The STP serves as a reference for developers, QA Engineers, project team members, and instructors/evaluators involved in verifying the correctness, security, performance, usability, and accessibility of the Online Exam Portal.

### 1.2 Scope

The testing scope covers the functionality and quality attributes of the Online Exam Portal, including:

- Student registration, authentication, and password reset.
- Role-based access control for Student, Teacher, and Admin.
- Question creation, tagging, editing, and deletion.
- Exam creation, configuration, scheduling, and publishing.
- Exam access control, countdown timer, auto-save, and submission.
- Automatic grading of MCQ and True/False questions.
- Manual grading of Short Answer questions.
- Result release by Teacher.
- Admin user management and dashboard functionality.
- Performance and concurrent exam session handling.
- User-facing error message handling.
- WCAG 2.1 Level AA accessibility.
- Security controls including HTTPS/TLS, password hashing, JWT invalidation, input validation, and CSRF protection.

The following are outside the scope of the current version:

- Video proctoring or AI-based cheating detection.
- Integration with third-party LMS platforms.
- Mobile native applications.
- Payment processing.
- Download Result PDF, which is planned for a future version and is not implemented in v1.0.

### 1.3 Audience

This document is intended for:

- **Developers:** To understand the testing requirements for implemented features and modules.
- **QA Engineers:** To execute and record the defined test cases.
- **System Architects:** To verify that testing covers the architectural components and interfaces.
- **Instructors / Evaluators:** To assess system correctness and project completeness.
- **Project Team Members:** To use as a shared reference for verification and validation activities.

### 1.4 Definitions

| Term | Definition |
|---|---|
| OEP | Online Exam Portal — the system being tested. |
| Student | A registered user who takes exams. |
| Teacher | A registered user who creates and manages exams and questions. |
| Admin | A privileged user who manages the platform, users, and system settings. |
| MCQ | Multiple Choice Question — a question with one or more correct options. |
| FR | Functional Requirement. |
| NFR | Non-Functional Requirement. |
| SR | Security Requirement. |
| RTM | Requirements Traceability Matrix. |
| UI | User Interface. |
| API | Application Programming Interface. |
| JWT | JSON Web Token — used for session authentication. |
| TLS | Transport Layer Security — protocol for encrypting data in transit. |
| RBAC | Role-Based Access Control. |
| SRS | Software Requirements Specification. |
| SAD | Software Architecture and Design. |
| STP | Software Test Plan. |
| UAT | User Acceptance Testing. |
