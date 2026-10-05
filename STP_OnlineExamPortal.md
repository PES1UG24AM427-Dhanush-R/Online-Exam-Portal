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


## 4. Test Cases

The following test cases verify the functional, non-functional, and security requirements defined in the SRS. Each test case is directly mapped to its corresponding requirement ID in the Requirements Traceability Matrix.

### 4.1 Authentication Test Cases

#### TC-Auth-01 — Student Registration

**Requirement ID:** OEP-F-001

**Test Objective:**  
Verify that a new Student can register successfully using a unique email address, full name, and password, and that duplicate email registration is rejected.

**Preconditions:**
1. The Online Exam Portal is accessible.
2. The registration functionality is available.
3. A test email address that is not already registered is available.

**Test Steps:**
1. Open the registration page.
2. Enter a valid full name.
3. Enter a unique email address.
4. Enter a valid password.
5. Submit the registration form.
6. Verify that the registration succeeds.
7. Repeat the registration using the same email address.

**Expected Result:**
- The first registration succeeds and a Student account is created.
- The password is stored securely rather than as plaintext.
- The second registration using the same email address is rejected with an appropriate error.

**Pass/Fail Criteria:**
- **Pass:** A valid unique registration succeeds and duplicate email registration is rejected.
- **Fail:** Registration fails with valid unique data or duplicate email registration is incorrectly accepted.

---

#### TC-Auth-02 — User Login and JWT Issuance

**Requirement ID:** OEP-F-002

**Test Objective:**  
Verify that valid Student, Teacher, and Admin credentials authenticate successfully and result in JWT issuance, while invalid credentials are rejected.

**Preconditions:**
1. The Online Exam Portal is accessible.
2. Valid test accounts exist for Student, Teacher, and Admin.
3. The accounts are not locked or deactivated.

**Test Steps:**
1. Open the login page.
2. Enter valid Student credentials.
3. Submit the login form.
4. Verify the authentication response.
5. Repeat the process using valid Teacher credentials.
6. Repeat the process using valid Admin credentials.
7. Attempt to log in using an invalid password.
8. Verify the response.

**Expected Result:**
- Valid credentials for Student, Teacher, and Admin are accepted.
- A JWT is issued after successful authentication.
- The JWT contains the user's role information.
- Invalid credentials return HTTP 401.

**Pass/Fail Criteria:**
- **Pass:** All valid roles receive successful authentication and invalid credentials return HTTP 401.
- **Fail:** Valid credentials are rejected, a JWT is not issued, or invalid credentials are accepted.

---

#### TC-Auth-03 — Account Lockout After Failed Login Attempts

**Requirement ID:** OEP-F-003

**Test Objective:**  
Verify that an account is locked for 15 minutes after 5 consecutive failed login attempts and becomes available again after the lockout period.

**Preconditions:**
1. A valid test account exists.
2. The account is not already locked.
3. The account's correct password is known.

**Test Steps:**
1. Attempt to log in using the correct email address and an incorrect password.
2. Repeat the failed login attempt until 5 consecutive failed attempts have occurred.
3. Attempt another login using the same incorrect password.
4. Verify that the account is locked.
5. Verify that the user receives the appropriate lockout notification.
6. Wait until the 15-minute lockout period expires.
7. Attempt to log in using the correct password.

**Expected Result:**
- The first 5 failed attempts are recorded.
- The subsequent login attempt is rejected because the account is locked.
- The lockout lasts for 15 minutes.
- The account can successfully log in using the correct password after the lockout period expires.

**Pass/Fail Criteria:**
- **Pass:** The account is locked after 5 consecutive failed attempts, remains locked for 15 minutes, and can be accessed after the lockout expires.
- **Fail:** The account is not locked, the lockout duration is incorrect, or the account remains inaccessible after the lockout period.

---

#### TC-Auth-04 — Server-Side RBAC Enforcement

**Requirement ID:** OEP-F-004

**Test Objective:**  
Verify that role-based access control is enforced server-side and unauthorized roles cannot access protected endpoints.

**Preconditions:**
1. Valid Student, Teacher, and Admin accounts exist.
2. Protected Teacher and Admin endpoints are available.
3. Valid authentication tokens are available for each role.

**Test Steps:**
1. Authenticate as a Student.
2. Send a request to a Teacher-only endpoint.
3. Verify the response.
4. Send a request to an Admin-only endpoint using the Student credentials.
5. Verify the response.
6. Authenticate as a Teacher.
7. Send a request to an Admin-only endpoint.
8. Verify the response.
9. Authenticate as an Admin.
10. Access an Admin-only endpoint.

**Expected Result:**
- Student access to Teacher-only and Admin-only endpoints is rejected with HTTP 403.
- Teacher access to Admin-only endpoints is rejected with HTTP 403.
- Admin access to permitted Admin endpoints is successful.
- Authorization is enforced by the server and is not dependent only on UI restrictions.

**Pass/Fail Criteria:**
- **Pass:** Unauthorized role requests return HTTP 403 and authorized requests succeed.
- **Fail:** An unauthorized role can access a protected endpoint.

---

#### TC-Auth-05 — Password Reset via Time-Limited Email Link

**Requirement ID:** OEP-F-005

**Test Objective:**  
Verify that a user can reset their password using a valid password-reset link and that expired or reused links are rejected.

**Preconditions:**
1. A registered test account exists.
2. The account's email address can receive test emails.
3. The password reset functionality is available.

**Test Steps:**
1. Open the password reset request page.
2. Enter the registered email address.
3. Submit the password reset request.
4. Retrieve the password reset email.
5. Open the reset link within the one-hour validity period.
6. Enter a new valid password.
7. Submit the password change.
8. Log in using the new password.
9. Attempt to use the same reset link again.
10. Test an expired reset link.

**Expected Result:**
- A password reset email is generated for the registered account.
- A valid reset link allows the password to be changed.
- The new password can be used to log in.
- The reset link cannot be reused after successful password reset.
- An expired reset link is rejected.

**Pass/Fail Criteria:**
- **Pass:** Valid links work within one hour, expired links are rejected, and reset links are single-use.
- **Fail:** An expired or previously used link can reset the password, or a valid link cannot be used within its allowed period.

### 4.2 Question Bank Test Cases

#### TC-QB-01 — Question Creation

**Requirement ID:** OEP-F-006

**Test Objective:**  
Verify that a Teacher can create and save all four supported question types: MCQ with a single correct answer, MCQ with multiple correct answers, True/False, and Short Answer.

**Preconditions:**
1. A valid Teacher account exists.
2. The Teacher is authenticated.
3. The QuestionBankModule is available.

**Test Steps:**
1. Log in as a Teacher.
2. Open the question creation interface.
3. Create an MCQ with a single correct answer.
4. Save the question.
5. Create an MCQ with multiple correct answers.
6. Save the question.
7. Create a True/False question.
8. Save the question.
9. Create a Short Answer question.
10. Save the question.
11. Retrieve the created questions from the question bank.

**Expected Result:**
- All four question types are successfully saved.
- Each question retains its question type, question text, options where applicable, and correct answer.
- All created questions can be retrieved correctly.

**Pass/Fail Criteria:**
- **Pass:** All four question types are created, saved, and retrieved with the correct information.
- **Fail:** Any supported question type cannot be created, saved, or retrieved correctly.

---

#### TC-QB-02 — Question Tagging

**Requirement ID:** OEP-F-007

**Test Objective:**  
Verify that a Teacher can assign subject, topic, and difficulty tags to questions and use those tags to filter or search questions.

**Preconditions:**
1. A valid Teacher account exists.
2. The Teacher is authenticated.
3. At least one question exists in the question bank.

**Test Steps:**
1. Open an existing question or create a new question.
2. Assign a subject to the question.
3. Assign a topic to the question.
4. Assign a difficulty level of Easy, Medium, or Hard.
5. Save the question.
6. Search or filter the question bank using the assigned subject.
7. Repeat using the assigned topic.
8. Repeat using the assigned difficulty level.

**Expected Result:**
- The question is saved with the selected subject, topic, and difficulty.
- Filtering or searching using the assigned tags returns the appropriate question.

**Pass/Fail Criteria:**
- **Pass:** All three tags are stored correctly and can be used for filtering/searching.
- **Fail:** A tag cannot be saved, is stored incorrectly, or does not work correctly when filtering/searching.

---

#### TC-QB-03 — Question Edit and Delete Restrictions

**Requirement ID:** OEP-F-008

**Test Objective:**  
Verify that a Teacher can edit or delete a question that is not part of an active or upcoming exam, while modification or deletion is prevented for questions used in an active or upcoming exam.

**Preconditions:**
1. A valid Teacher account exists.
2. The Teacher is authenticated.
3. One question exists that is not associated with an active or upcoming exam.
4. Another question is associated with an active or upcoming exam.

**Test Steps:**
1. Open the question that is not used in an active or upcoming exam.
2. Edit the question text or other permitted details.
3. Save the changes.
4. Verify that the changes are stored.
5. Delete the same question.
6. Verify that it is removed from the question bank.
7. Open the question associated with an active or upcoming exam.
8. Attempt to edit the question.
9. Attempt to delete the question.

**Expected Result:**
- A question not used in an active or upcoming exam can be edited successfully.
- A question not used in an active or upcoming exam can be deleted successfully.
- Attempts to edit or delete a question used in an active or upcoming exam are rejected with an appropriate error.

**Pass/Fail Criteria:**
- **Pass:** Modification and deletion are allowed only when the question is not part of an active or upcoming exam.
- **Fail:** A protected question can be modified/deleted, or an unrestricted question cannot be modified/deleted.

---

### 4.3 Exam Management Test Cases

#### TC-Exam-01 — Exam Creation and Mark Allocation

**Requirement ID:** OEP-F-009

**Test Objective:**  
Verify that a Teacher can create an exam by selecting questions from the question bank and assigning marks to each question.

**Preconditions:**
1. A valid Teacher account exists.
2. The Teacher is authenticated.
3. Questions are available in the question bank.

**Test Steps:**
1. Log in as a Teacher.
2. Open the exam creation interface.
3. Select questions from the question bank.
4. Assign marks to each selected question.
5. Save the exam.
6. Reopen the saved exam.
7. Verify the selected questions and their mark allocations.
8. Verify the calculated total marks.

**Expected Result:**
- The exam is saved successfully.
- The selected questions are associated with the exam.
- Each question has the assigned marks.
- The total marks are calculated correctly from the question mark allocations.

**Pass/Fail Criteria:**
- **Pass:** The exam contains the correct questions, marks, and calculated total.
- **Fail:** Questions or marks are missing/incorrect, or the total marks are calculated incorrectly.

---

#### TC-Exam-02 — Exam Settings Configuration

**Requirement ID:** OEP-F-010

**Test Objective:**  
Verify that a Teacher can configure the exam duration, start datetime, end datetime, and question-order randomization settings and that these settings are enforced when the exam runs.

**Preconditions:**
1. A valid Teacher account exists.
2. The Teacher is authenticated.
3. Questions are available for exam creation.

**Test Steps:**
1. Create an exam.
2. Set the exam duration in minutes.
3. Set the start datetime.
4. Set the end datetime.
5. Enable or disable question-order randomization.
6. Save the exam settings.
7. Verify that the configured settings are stored.
8. Start the exam during the configured access window.
9. Verify that the configured duration and question-order setting are applied.

**Expected Result:**
- All configured settings are saved correctly.
- The exam uses the configured duration.
- The configured start and end times control access to the exam.
- Question order follows the configured shuffle setting.

**Pass/Fail Criteria:**
- **Pass:** All configured exam settings are stored and enforced correctly.
- **Fail:** Any setting is not saved correctly or is not enforced when the exam runs.

---

#### TC-Exam-03 — Exam Publishing and Student Visibility

**Requirement ID:** OEP-F-011

**Test Objective:**  
Verify that a Teacher can publish an exam and that the exam becomes visible and accessible to enrolled Students only within the configured time window.

**Preconditions:**
1. A valid Teacher account exists.
2. A valid Student account exists.
3. The Teacher is authenticated.
4. An exam exists in an unpublished state.
5. The exam has a configured future start datetime.

**Test Steps:**
1. Log in as a Teacher.
2. Publish the exam.
3. Log in as a Student before the configured start datetime.
4. Check the Student dashboard.
5. Verify that the unpublished/not-yet-started exam is not accessible.
6. Wait until the configured start datetime.
7. Refresh the Student dashboard.
8. Verify that the published exam is visible and accessible.

**Expected Result:**
- The Teacher can publish the exam.
- The exam is not accessible to Students before its configured start datetime.
- After the start datetime, the published exam becomes visible and accessible to the appropriate Students.

**Pass/Fail Criteria:**
- **Pass:** Publishing succeeds and Student visibility/access follows the configured start time.
- **Fail:** Students can access the exam before its start time, or the published exam remains inaccessible after the start time.

### 4.4 Exam Taking Test Cases

#### TC-Take-01 — Countdown Timer and Auto-Submit

**Requirement ID:** OEP-F-012

**Test Objective:**  
Verify that the Student is shown a countdown timer during an exam and that the exam is automatically submitted when the timer reaches zero using server-authoritative timing.

**Preconditions:**
1. A valid Student account exists.
2. The Student is authenticated.
3. A published exam is available within its configured access window.
4. The exam has a configured duration.
5. The Student has not previously attempted the exam.

**Test Steps:**
1. Log in as a Student.
2. Open the available exam.
3. Start the exam.
4. Verify that the countdown timer is displayed.
5. Answer one or more questions.
6. Allow the exam timer to reach zero.
7. Observe the system behavior when the timer expires.
8. Verify the submission status and saved answers.

**Expected Result:**
- The countdown timer is visible throughout the exam.
- The timer is synchronized with the server time.
- When the server determines that the exam duration has expired, the exam is automatically submitted.
- Answers entered before the timer expires are preserved.
- The Student cannot submit additional answers after the exam has expired.

**Pass/Fail Criteria:**
- **Pass:** The server-authoritative timer reaches zero and automatically submits the exam with the answered questions preserved.
- **Fail:** The timer is missing, relies incorrectly on client time, fails to auto-submit, or allows submission after expiration.

---

#### TC-Take-02 — Exam Access Window Enforcement

**Requirement ID:** OEP-F-013

**Test Objective:**  
Verify that a Student cannot access an exam before its scheduled start time or after its scheduled end time.

**Preconditions:**
1. A valid Student account exists.
2. The Student is authenticated.
3. A published exam has a configured start and end datetime.

**Test Steps:**
1. Attempt to access the exam before its scheduled start time.
2. Verify the response.
3. Wait until the exam enters its configured access window.
4. Attempt to start the exam.
5. Verify that access is allowed.
6. After the configured end time, attempt to access or continue the exam.
7. Verify the response.

**Expected Result:**
- Access before the scheduled start time is denied.
- Access during the configured window is allowed.
- Access after the scheduled end time is denied.
- The access-window validation is enforced by the server.

**Pass/Fail Criteria:**
- **Pass:** Access is correctly allowed only within the configured exam window.
- **Fail:** A Student can access the exam before its start time or after its end time.

---

#### TC-Take-03 — Automatic Answer Saving and Restoration

**Requirement ID:** OEP-F-014

**Test Objective:**  
Verify that a Student's answers are automatically saved every 60 seconds and restored when the Student reconnects to the ongoing exam.

**Preconditions:**
1. A valid Student account exists.
2. The Student is authenticated.
3. A published exam is available within its access window.
4. The Student has started an exam attempt.
5. The exam has sufficient remaining time for the reconnect test.

**Test Steps:**
1. Start the exam as a Student.
2. Answer one or more questions.
3. Keep the exam open until the 60-second auto-save interval is reached.
4. Verify that the answers are saved.
5. Close the browser or simulate a connection interruption.
6. Reconnect to the portal while the exam is still within its allowed time window.
7. Reopen the ongoing exam attempt.
8. Check the previously answered questions.

**Expected Result:**
- Answers are automatically saved every 60 seconds.
- Previously saved answers are restored when the Student reconnects.
- The exam timer continues based on server time and is not reset by the reconnect.
- The Student can continue the exam if the access window has not expired.

**Pass/Fail Criteria:**
- **Pass:** Saved answers are restored correctly and the timer is not reset after reconnecting.
- **Fail:** Answers are lost, incorrect answers are restored, or the timer is reset.

---

#### TC-Take-04 — Duplicate Exam Submission Prevention

**Requirement ID:** OEP-F-015

**Test Objective:**  
Verify that a Student cannot submit the same exam attempt more than once.

**Preconditions:**
1. A valid Student account exists.
2. The Student is authenticated.
3. A valid exam attempt exists.
4. The exam has not yet been submitted.

**Test Steps:**
1. Open the ongoing exam attempt.
2. Answer one or more questions.
3. Submit the exam.
4. Verify that the first submission succeeds.
5. Attempt to submit the same exam attempt again.
6. Verify the response.
7. Check the attempt record.

**Expected Result:**
- The first submission is successfully recorded.
- The attempt is marked as submitted.
- The second submission attempt is rejected with an appropriate error, such as HTTP 409 Conflict.
- The original submission remains preserved.

**Pass/Fail Criteria:**
- **Pass:** Only the first submission is accepted and subsequent submissions are rejected.
- **Fail:** The Student can submit the same exam attempt more than once or the original submission is overwritten.

### 4.5 Grading and Results Test Cases

#### TC-Grade-01 — Automatic Grading for MCQ and True/False

**Requirement ID:** OEP-F-016

**Test Objective:**  
Verify that the system automatically calculates the score for MCQ and True/False questions immediately after exam submission.

**Preconditions:**
1. A valid Student account exists.
2. A valid Teacher account exists.
3. An exam containing MCQ and True/False questions has been created.
4. Correct answers and mark allocations are configured.
5. The Student has an active exam attempt.

**Test Steps:**
1. Start the exam as a Student.
2. Answer the MCQ questions with a mixture of correct and incorrect answers.
3. Answer the True/False questions with a mixture of correct and incorrect answers.
4. Submit the exam.
5. Retrieve the generated score.
6. Compare the calculated score with the configured answer key and mark allocation.

**Expected Result:**
- MCQ and True/False questions are automatically graded on submission.
- Correct answers receive the appropriate marks.
- Incorrect answers receive the appropriate score according to the configured grading logic.
- The total automatically calculated score matches the expected score.

**Pass/Fail Criteria:**
- **Pass:** The automatically calculated score exactly matches the expected score based on the answer key and mark allocation.
- **Fail:** Any objective question is graded incorrectly or the total score is incorrect.

---

#### TC-Grade-02 — Manual Grading of Short Answer

**Requirement ID:** OEP-F-017

**Test Objective:**  
Verify that a Teacher can review a Student's Short Answer response, assign marks within the allowed range, and save the assigned score.

**Preconditions:**
1. A valid Teacher account exists.
2. A submitted exam contains at least one Short Answer question.
3. A Student has submitted the exam.
4. The Teacher is authenticated.

**Test Steps:**
1. Log in as a Teacher.
2. Open the grading interface.
3. Select the submitted Student attempt.
4. Open a Short Answer response.
5. Review the Student's response.
6. Enter a score within the allowed mark range.
7. Save the score.
8. Reopen the grading record.
9. Verify the saved score.

**Expected Result:**
- The Teacher can view the Student's Short Answer response.
- The Teacher can enter a valid score within the allowed range.
- The score is saved successfully.
- The saved score is displayed correctly when the grading record is reopened.

**Pass/Fail Criteria:**
- **Pass:** The Teacher can review, score, and save the Short Answer response correctly.
- **Fail:** The response cannot be viewed, an invalid score is accepted, or the valid score is not saved correctly.

---

#### TC-Grade-03 — Result Release by Teacher

**Requirement ID:** OEP-F-018

**Test Objective:**  
Verify that Students cannot view examination results until the Teacher explicitly releases them and can view the results after release.

**Preconditions:**
1. A valid Student account exists.
2. A valid Teacher account exists.
3. A submitted exam has been graded.
4. The exam results have not yet been released.

**Test Steps:**
1. Log in as the Student.
2. Open the results section.
3. Verify that the score for the completed exam is not visible.
4. Log in as the Teacher.
5. Open the exam results.
6. Mark the results as released.
7. Log in as the Student again.
8. Open the results section.

**Expected Result:**
- The Student cannot view the exam score before result release.
- The Teacher can explicitly release the results.
- After release, the Student can view the examination score on the Student dashboard.

**Pass/Fail Criteria:**
- **Pass:** Results remain hidden before Teacher release and become visible after release.
- **Fail:** The Student can view results before release or cannot view them after the Teacher releases them.

### 4.7 Non-Functional Requirement Test Cases

#### TC-Perf-01 — Response Time Under Load

**Requirement ID:** OEP-NF-001

**Test Objective:**  
Verify that the system maintains a 95th percentile response time of 3 seconds or less under the specified concurrent user load.

**Preconditions:**
1. The Online Exam Portal is deployed in the test environment.
2. A representative test dataset is available.
3. A load-testing tool is configured.
4. The system is accessible to test users.

**Test Steps:**
1. Configure the load-testing tool to simulate 100 concurrent users.
2. Execute representative operations such as login, exam access, question retrieval, answer submission, and result retrieval.
3. Run the load test for the defined test period.
4. Record the response times for the executed requests.
5. Calculate the 95th percentile response time.
6. Compare the measured response time against the 3-second requirement.

**Expected Result:**
- The system continues processing requests under the specified load.
- The 95th percentile response time is 3 seconds or less.

**Pass/Fail Criteria:**
- **Pass:** The measured 95th percentile response time is ≤ 3 seconds.
- **Fail:** The measured 95th percentile response time exceeds 3 seconds.

---

#### TC-Perf-02 — Concurrent Exam Session Handling

**Requirement ID:** OEP-NF-003

**Test Objective:**  
Verify that the system supports up to 100 concurrent active exam sessions without data integrity issues or unacceptable performance degradation.

**Preconditions:**
1. The Online Exam Portal is deployed in the test environment.
2. At least 200 registered test users are available.
3. A published exam is available.
4. A load-testing tool is configured.

**Test Steps:**
1. Configure the load-testing tool to simulate 100 Students taking the same or equivalent active exams concurrently.
2. Start the exam sessions.
3. Perform representative actions such as loading questions, saving answers, and submitting attempts.
4. Monitor server response times and system behavior.
5. Verify that all exam attempts are stored correctly.
6. Verify that submitted answers are associated with the correct Student attempts.
7. Check for failed submissions, duplicate attempts, or corrupted data.
8. Compare observed performance against the response-time requirement in OEP-NF-001.

**Expected Result:**
- All 100 concurrent exam sessions can operate successfully.
- Exam answers and submissions remain correctly associated with their respective Students.
- No data corruption or integrity issues occur.
- The system does not experience unacceptable performance degradation beyond the OEP-NF-001 threshold.

**Pass/Fail Criteria:**
- **Pass:** 100 concurrent active exam sessions are supported without data integrity issues and within the required performance threshold.
- **Fail:** Exam data is corrupted/lost, submissions fail incorrectly, or performance exceeds the specified threshold.

---

#### TC-UX-01 — User-Facing Error Messages

**Requirement ID:** OEP-NF-004

**Test Objective:**  
Verify that user-facing error messages do not expose stack traces, database errors, file paths, or other internal system information.

**Preconditions:**
1. The Online Exam Portal is deployed in the test environment.
2. A valid test account is available.
3. The system contains error-handling mechanisms for invalid requests.

**Test Steps:**
1. Submit invalid login credentials.
2. Submit invalid or incomplete form data.
3. Attempt to access an unauthorized resource.
4. Send invalid data to a protected API endpoint.
5. Trigger an invalid database-related request through the application interface.
6. Observe the error messages returned by the application.
7. Inspect the browser response and API response for exposed internal information.

**Expected Result:**
- Error messages are understandable to the user.
- Stack traces are not displayed.
- Database error messages are not exposed.
- Server file paths are not exposed.
- Internal implementation details are not revealed to the user.

**Pass/Fail Criteria:**
- **Pass:** All tested error conditions return safe, user-facing error messages without internal system details.
- **Fail:** Any stack trace, database error, file path, or sensitive internal information is exposed.

---

#### TC-UX-02 — Accessibility Compliance

**Requirement ID:** OEP-NF-005

**Test Objective:**  
Verify that the Online Exam Portal meets WCAG 2.1 Level AA accessibility requirements, including color contrast, keyboard navigation, and ARIA support.

**Preconditions:**
1. The Online Exam Portal is deployed in the test environment.
2. The main Student, Teacher, and Admin interfaces are available.
3. An accessibility auditing tool is available.
4. A keyboard is available for manual accessibility testing.

**Test Steps:**
1. Run an automated accessibility audit on the main application pages.
2. Check color contrast for text and user-interface elements.
3. Navigate through the application using only the keyboard.
4. Verify that interactive elements can be reached and operated using keyboard controls.
5. Check that relevant form controls and interactive elements have appropriate accessible labels and ARIA attributes where required.
6. Record accessibility violations.
7. Verify that identified violations are addressed or documented.

**Expected Result:**
- The application satisfies WCAG 2.1 Level AA requirements within the defined scope.
- Required color contrast is maintained.
- Main functionality can be accessed using keyboard navigation.
- Relevant interactive elements have appropriate accessibility labels and ARIA support.

**Pass/Fail Criteria:**
- **Pass:** No critical accessibility violations are identified and the tested interfaces satisfy the required WCAG 2.1 Level AA criteria.
- **Fail:** Critical accessibility barriers remain or required keyboard, contrast, or ARIA support is missing.

### 4.8 Security Test Cases

#### TC-Sec-01 — HTTPS and TLS Security

**Requirement ID:** OEP-SR-001

**Test Objective:**  
Verify that all application traffic is protected using HTTPS with TLS 1.2 or higher and that HTTP requests are redirected to HTTPS.

**Preconditions:**
1. The Online Exam Portal is deployed with HTTPS enabled.
2. A valid test domain or deployment endpoint is available.
3. A TLS/security scanning tool is available.

**Test Steps:**
1. Open the application using an HTTP URL.
2. Observe the server response.
3. Verify that the HTTP request is redirected to the HTTPS URL.
4. Open the application using HTTPS.
5. Run a TLS security scan against the application.
6. Verify the supported TLS protocol versions.
7. Verify that TLS 1.2 or higher is supported.

**Expected Result:**
- HTTP requests are redirected to HTTPS using HTTP 301.
- Application communication occurs over HTTPS.
- TLS 1.2 or higher is supported.
- Insecure protocol versions are not used for application communication.

**Pass/Fail Criteria:**
- **Pass:** HTTP requests are redirected to HTTPS and the application supports TLS 1.2 or higher.
- **Fail:** HTTP traffic remains accessible without redirection or an unsupported/insecure TLS configuration is detected.

---

#### TC-Sec-02 — Password Hashing

**Requirement ID:** OEP-SR-002

**Test Objective:**  
Verify that user passwords are stored as salted bcrypt hashes and are not stored in plaintext.

**Preconditions:**
1. A valid test user account exists.
2. Database access is available to the tester.
3. The authentication system is operational.

**Test Steps:**
1. Register a test user or change the password of an existing test account.
2. Inspect the corresponding user record in the database.
3. Verify the stored password value.
4. Verify that the stored value is a bcrypt hash.
5. Verify that the bcrypt cost factor satisfies the minimum required value.
6. Check that the plaintext password is not stored in the database or application logs.

**Expected Result:**
- Passwords are stored as salted bcrypt hashes.
- The bcrypt cost factor is at least 10.
- Plaintext passwords are not stored or exposed.

**Pass/Fail Criteria:**
- **Pass:** All tested passwords are stored securely using bcrypt with the required cost factor and no plaintext password is exposed.
- **Fail:** A plaintext password is stored/exposed or the bcrypt cost factor is below the required minimum.

---

#### TC-Sec-03 — JWT Invalidation After Logout

**Requirement ID:** OEP-SR-003

**Test Objective:**  
Verify that a JWT issued before logout cannot be used to access protected resources after the Student logs out.

**Preconditions:**
1. A valid Student account exists.
2. The Student can successfully log in.
3. A protected API endpoint is available.

**Test Steps:**
1. Log in as the Student.
2. Capture the authenticated session token according to the implemented authentication mechanism.
3. Access a protected resource using the valid authenticated session.
4. Log out from the application.
5. Attempt to access the same protected resource using the previously issued token/session.
6. Observe the server response.

**Expected Result:**
- The authenticated request before logout is successful.
- Logout invalidates the previous authentication session/token.
- A request using the old token after logout is rejected with HTTP 401 Unauthorized.

**Pass/Fail Criteria:**
- **Pass:** The old authentication token/session cannot access protected resources after logout and returns HTTP 401.
- **Fail:** The old token/session remains valid after logout.

---

#### TC-Sec-04 — Input Validation Against SQL Injection and XSS

**Requirement ID:** OEP-SR-004

**Test Objective:**  
Verify that server-side input validation prevents malicious SQL injection and Cross-Site Scripting (XSS) inputs from being executed or causing unintended database/application behavior.

**Preconditions:**
1. The Online Exam Portal is deployed in the test environment.
2. Test accounts with appropriate permissions are available.
3. Input fields and API endpoints accepting user-controlled data are identified.

**Test Steps:**
1. Identify application fields that accept user input.
2. Submit representative SQL injection payloads through applicable input fields and API parameters.
3. Observe the application response and database behavior.
4. Submit representative XSS payloads through applicable text fields.
5. Retrieve and display the submitted data where applicable.
6. Inspect the response for script execution or unsafe rendering.
7. Verify that malicious input is rejected, safely handled, or encoded.
8. Verify that no database records are improperly modified or exposed.

**Expected Result:**
- Malicious SQL input does not alter or expose unintended database data.
- XSS payloads are not executed in the user's browser.
- Server-side validation and safe input handling are applied.
- No sensitive database or internal system information is exposed.

**Pass/Fail Criteria:**
- **Pass:** SQL injection and XSS attempts are safely rejected or handled without unauthorized execution, data access, or modification.
- **Fail:** Malicious input is executed, causes unauthorized database access/modification, or results in XSS.

---

#### TC-Sec-05 — CSRF Protection

**Requirement ID:** OEP-SR-005

**Test Objective:**  
Verify that state-changing requests are protected against Cross-Site Request Forgery (CSRF).

**Preconditions:**
1. The Online Exam Portal is deployed in the test environment.
2. A valid authenticated user account exists.
3. State-changing endpoints such as POST, PUT, or DELETE are available.
4. A valid CSRF protection mechanism is implemented.

**Test Steps:**
1. Log in as an authenticated user.
2. Identify a state-changing operation such as creating, editing, or deleting data.
3. Send the request without the required CSRF token.
4. Observe the server response.
5. Send the request with an invalid CSRF token.
6. Observe the server response.
7. Send the request with a valid CSRF token.
8. Verify the result.

**Expected Result:**
- Requests without a valid CSRF token are rejected.
- Requests containing an invalid CSRF token are rejected with an appropriate error such as HTTP 403 Forbidden.
- Requests containing a valid CSRF token are processed successfully.
- CSRF protection is applied to applicable state-changing endpoints.

**Pass/Fail Criteria:**
- **Pass:** Unauthorized state-changing requests are blocked and valid requests with the correct CSRF protection are accepted.
- **Fail:** A state-changing request can be completed without valid CSRF protection.
