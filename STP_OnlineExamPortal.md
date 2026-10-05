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


## 2. Test Strategy

The Online Exam Portal will be tested using four levels of testing: Unit Testing, Integration Testing, System Testing, and User Acceptance Testing (UAT). The testing strategy verifies individual module functionality, interactions between modules, complete end-to-end workflows, and compliance with the acceptance criteria defined in the SRS.

### 2.1 Unit Testing

Unit testing will verify individual functions and components within each backend module independently. The objective is to identify defects at the smallest testable level before modules are integrated.

The following modules will be covered:

- **AuthModule:** Registration, login, JWT generation and validation, account lockout, password reset, and RBAC middleware.
- **QuestionBankModule:** Question creation, tagging, editing, deletion, and retrieval.
- **ExamModule:** Exam creation, mark allocation, exam configuration, scheduling, and publishing.
- **ExamTakingModule:** Exam access validation, server-authoritative timer, auto-save, and submission handling.
- **GradingModule:** Automatic grading, manual grading, and result release.
- **AdminModule:** User management, role assignment, active exam monitoring, and system health dashboard.

Unit tests will verify valid inputs, invalid inputs, boundary conditions, and expected error handling for individual functions.

### 2.2 Integration Testing

Integration testing will verify that the six backend modules and their supporting components interact correctly.

The following interactions will be tested:

- **AuthModule** with the Email Service for password reset notifications.
- **AuthModule** with protected backend modules through JWT validation and RBAC middleware.
- **QuestionBankModule** with **ExamModule** when questions are selected for exam creation.
- **ExamModule** with **ExamTakingModule** for exam scheduling and access-window enforcement.
- **ExamTakingModule** with **GradingModule** when a Student submits an exam.
- **GradingModule** with result data when Teacher releases examination results.
- **AdminModule** with MySQL for user management and dashboard information.
- All backend modules with the **MySQL Database** for persistent data storage.

Integration testing will verify correct data flow, API responses, authentication, authorization, and error handling between connected components.

### 2.3 System Testing

System testing will validate the complete Online Exam Portal as an integrated system against the functional, non-functional, and security requirements defined in the SRS.

End-to-end scenarios will include:

1. A Student registering and logging into the portal.
2. A Teacher creating questions and configuring an exam.
3. A Teacher publishing an exam.
4. A Student accessing the exam within the permitted time window.
5. A Student answering questions while answers are automatically saved.
6. The system automatically submitting the exam when the server-authoritative timer reaches zero.
7. The system automatically grading MCQ and True/False questions.
8. A Teacher manually grading Short Answer responses.
9. A Teacher releasing the examination results.
10. An Admin managing user accounts and monitoring active exams.

System testing will also verify performance, concurrent exam sessions, accessibility, error handling, and security requirements.

### 2.4 User Acceptance Testing (UAT)

User Acceptance Testing will validate that the Online Exam Portal satisfies the acceptance criteria defined in Section 6 of the SRS.

UAT will involve the three system roles:

- **Student:** Validate registration, login, exam access, exam taking, auto-save, submission, and result viewing.
- **Teacher:** Validate question management, exam creation, configuration, publishing, grading, and result release.
- **Admin:** Validate user management, active exam monitoring, and system health dashboard.

UAT will use the acceptance test suites defined in the SRS:

| Acceptance Test Suite | Requirements Covered |
|---|---|
| Authentication Suite | OEP-F-001 to OEP-F-005 |
| Question Bank Suite | OEP-F-006 to OEP-F-008 |
| Exam Management Suite | OEP-F-009 to OEP-F-011 |
| Exam Taking Suite | OEP-F-012 to OEP-F-015 |
| Grading & Results Suite | OEP-F-016 to OEP-F-018 |
| Admin Suite | OEP-F-019 to OEP-F-020 |
| Performance Suite | OEP-NF-001, OEP-NF-003 |
| Security Suite | OEP-SR-001 to OEP-SR-005 |
| Accessibility Suite | OEP-NF-005 |

The system will be considered ready for acceptance when the SRS exit criteria are satisfied, including verification of all high-priority functional requirements, high-priority non-functional requirements, all security requirements, 100% execution of planned test cases with no critical (P1) defects open, and UAT sign-off from the course coordinator or product owner.


## 3. Test Environment

The test environment will provide the hardware, software, database, network, and test data required to execute the functional, non-functional, and security test cases for the Online Exam Portal.

### 3.1 Hardware Requirements

The following hardware will be used for testing:

- Client computers or laptops for Student, Teacher, and Admin testing.
- A Linux-based server environment for hosting the backend application.
- Sufficient CPU and memory resources to perform concurrent-user and performance testing.
- Stable network connectivity for testing normal operation, reconnect scenarios, and HTTPS communication.
- Standard keyboard, mouse, and display for UI and accessibility testing.

The test environment must support testing of up to 100 concurrent active exam sessions as required by OEP-NF-003.

### 3.2 Software Requirements

| Component | Test Environment |
|---|---|
| Frontend | HTML5 / CSS3 / JavaScript or React |
| Backend | Node.js with Express.js |
| Database | MySQL |
| Authentication | JWT + bcrypt |
| Email Service | Nodemailer (SMTP) or SendGrid API |
| Communication | HTTPS / TLS 1.2+ |
| Operating Environment | Linux-based server |
| Client | Modern web browser such as Chrome, Firefox, Edge, or Safari |
| Version Control | Git / GitHub |

The test environment will use the same core technologies defined in the SRS and SAD to ensure that test results represent the intended application environment. :chatgpt-content-reference{index="0"}

### 3.3 Testing Tools

The following tools and methods will be used where applicable:

| Tool / Method | Purpose |
|---|---|
| Postman | API testing for REST endpoints |
| MySQL / MySQL Workbench | Database inspection and verification |
| Browser Developer Tools | UI, network, and client-side verification |
| Accessibility audit tools | Verification of WCAG 2.1 Level AA requirements |
| Load testing tools | Performance and concurrent-user testing |
| TLS scanning tools | Verification of HTTPS and TLS 1.2+ enforcement |
| Git / GitHub | Test documentation and version control |

Postman and MySQL Workbench are also identified in the SAD as project tools. :chatgpt-content-reference{index="1"}

### 3.4 Test Data

Test data will be prepared for each system role and testing category.

| Role / Category | Test Data |
|---|---|
| Student | Valid and invalid registration details, login credentials, exam attempts, answers, and submission data |
| Teacher | Questions of all four supported types, question tags, exam configurations, mark allocations, and Short Answer responses |
| Admin | Student, Teacher, and Admin accounts for creation, deactivation, deletion, and role-management testing |
| Authentication | Valid credentials, invalid credentials, repeated failed login attempts, and password-reset requests |
| Exam | Exams with different durations, start/end times, shuffle settings, questions, and mark allocations |
| Performance | Data required to simulate 100 concurrent users and 100 concurrent active exam sessions |
| Security | Invalid input, SQL injection strings, XSS payloads, invalid JWTs, and invalid/missing CSRF tokens |
| Accessibility | Portal pages, forms, navigation controls, buttons, and interactive elements for keyboard and screen-reader testing |

Test data containing real user passwords or other sensitive information will not be used. Passwords used during testing will be test credentials and must follow the same security controls as production data.
