# Online Exam Portal — Architectural Diagrams & Flow Descriptions

**Author:** Sumit Nagaraj Bali  
**Project:** Online Exam Portal v1.0  
**Related Document:** `SAD_OnlineExamPortal.md`  

---

## 1. System Component Diagram

![Component Diagram](component_diagram.png)

### Architectural Overview
The system follows a three-tier layered architecture consisting of:
1. **Presentation Tier (Client):** Web Browser rendering HTML/CSS/JavaScript or React UI for `Student`, `Teacher`, and `Admin` actors.
2. **Application Tier (Business Logic):** Node.js and Express.js backend containing six isolated feature routers (`AuthModule`, `QuestionBankModule`, `ExamModule`, `ExamTakingModule`, `GradingModule`, `AdminModule`). Express middleware handles HTTPS enforcement, JWT authentication, RBAC checks, and input sanitization without requiring a separate API Gateway.
3. **Data & Services Tier:** Persistent MySQL database accessed strictly via parameterized queries over internal network, and an external Email Service (SMTP/Nodemailer) for notifications.

---

## 2. Sequence Diagram 1 — Student Login & Start Exam Flow

![Sequence Diagram 1 — Student Login & Start Exam](sequence_diagram_1.png)

### Detailed Interaction Workflow
1. **Credentials Submission:** The `Student` submits login credentials (email and password) via the Web Browser interface.
2. **Authentication Check:** The browser sends `POST /api/auth/login` to `AuthModule`.
3. **Database Validation:** `AuthModule` queries user details and account status from `MySQL Database`.
4. **Credential Verification:** `AuthModule` checks the `bcrypt` password hash (cost factor $\ge 10$) and verifies the account is not locked out (under 5 failed attempts).
5. **Token Generation:** Upon success, `AuthModule` generates a stateless JWT containing the user ID and `Student` role claim, returning an HTTP 200 response with an HttpOnly cookie.
6. **Exam Selection:** The `Student` selects an active exam from their dashboard.
7. **Attempt Initialization:** The browser issues `POST /api/attempt/start` with the Bearer JWT to `ExamTakingModule`.
8. **Window & Duplicate Check:** `ExamTakingModule` verifies that the current timestamp is within the exam's active start/end window and checks that no prior attempt exists for this student.
9. **Attempt Recording:** An attempt record is created in the database with a server-authoritative start timestamp (`INSERT INTO attempts`).
10. **Question Delivery:** `ExamTakingModule` returns an HTTP 201 response containing the question list, duration in seconds, and current `serverTime`.
11. **Client Rendering:** The browser renders the questions and initializes the visual countdown timer synchronized with the server clock.

---

## 3. Sequence Diagram 2 — Exam Submission & Auto-Grading Flow

![Sequence Diagram 2 — Exam Submission & Auto-Grading](sequence_diagram_2.png)

### Detailed Interaction Workflow
1. **Submission Trigger:** The `Student` clicks the "Submit" button, or the server-authoritative countdown timer reaches zero (triggering auto-submit).
2. **Submission Request:** The browser sends `POST /api/attempt/:attemptId/submit` with all final answers to `ExamTakingModule`.
3. **Attempt State Verification:** `ExamTakingModule` queries `MySQL Database` to ensure the attempt exists, belongs to the student, is currently active, and has not been submitted previously.
4. **Answer Persistence:** Answers are saved (`INSERT INTO answers`) and the attempt status is updated to `submitted` (`UPDATE attempts SET status='submitted'`).
5. **Auto-Grading Execution:** `ExamTakingModule` invokes `GradingModule` to process objective question scoring.
6. **Key Retrieval:** `GradingModule` fetches the correct answer keys and allocated marks for all MCQ and True/False questions from `MySQL Database`.
7. **Score Calculation:** The engine compares student answers to answer keys and calculates the total auto-graded score.
8. **Database Write:** `GradingModule` writes the calculated score back to the `attempts` table.
9. **Client Confirmation:** `ExamTakingModule` returns HTTP 200 OK with a submission confirmation payload.
10. **UI Update:** The Web Browser renders the "Exam Submitted Successfully" screen. Results remain pending until released by the `Teacher`.