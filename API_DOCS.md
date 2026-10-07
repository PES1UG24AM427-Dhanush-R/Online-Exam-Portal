# API Documentation — Online Exam Portal

This document provides complete specification for all REST API endpoints provided by the **Online Exam Portal** backend service.

---

## Overview & General Conventions

- **Base URL:** `/api`
- **Protocol:** HTTPS / TLS 1.2+
- **Data Format:** `application/json`
- **Authentication:** JWT stored in HttpOnly, SameSite cookies (`token`) or supplied via HTTP Authorization header (`Authorization: Bearer <token>`).
- **CSRF Protection:** Double-submit CSRF protection required on state-modifying requests (`POST`, `PUT`, `PATCH`, `DELETE`). The token is provided in the `x-csrf-token` header or request body.
- **Roles:** `Student`, `Teacher`, `Admin`

---

## Table of Contents

- [AuthModule](#authmodule)
  - [GET /api/auth/csrf-token](#get-apiauthcsrf-token)
  - [POST /api/auth/register](#post-apiauthregister)
  - [POST /api/auth/login](#post-apiauthlogin)
  - [POST /api/auth/logout](#post-apiauthlogout)
  - [POST /api/auth/forgot-password](#post-apiauthforgot-password)
  - [POST /api/auth/reset-password](#post-apiauthreset-password)
- [QuestionBankModule](#questionbankmodule)
  - [GET /api/questions](#get-apiquestions)
  - [POST /api/questions](#post-apiquestions)
  - [PUT /api/questions/:id](#put-apiquestionsid)
  - [DELETE /api/questions/:id](#delete-apiquestionsid)
- [ExamModule](#exammodule)
  - [GET /api/exams](#get-apiexams)
  - [GET /api/exams/:id](#get-apiexamsid)
  - [POST /api/exams](#post-apiexams)
  - [PUT /api/exams/:id](#put-apiexamsid)
  - [PATCH /api/exams/:id/publish](#patch-apiexamsidpublish)
- [ExamTakingModule](#examtakingmodule)
  - [POST /api/attempt/start](#post-apiattemptstart)
  - [POST /api/attempt/:id/autosave](#post-apiattemptidautosave)
  - [POST /api/attempt/:id/submit](#post-apiattemptidsubmit)
- [GradingModule](#gradingmodule)
  - [GET /api/grading/:attemptId](#get-apigradingattemptid)
  - [PATCH /api/grading/:attemptId](#patch-apigradingattemptid)
  - [PATCH /api/grading/:examId/release](#patch-apigradingexamidrelease)
  - [GET /api/grading/results/:examId](#get-apigradingresultsexamid)
- [AdminModule](#adminmodule)
  - [GET /api/admin/users](#get-apiadminusers)
  - [POST /api/admin/users](#post-apiadminusers)
  - [PATCH /api/admin/users/:id](#patch-apiadminusersid)
  - [DELETE /api/admin/users/:id](#delete-apiadminusersid)
  - [GET /api/admin/dashboard](#get-apiadmindashboard)
- [Health](#health)
  - [GET /api/health](#get-apihealth)

---

## AuthModule

### GET /api/auth/csrf-token

- **Description:** Fetches a fresh CSRF token required for subsequent state-modifying HTTP requests.
- **Authentication Required:** No
- **Role Required:** Any
- **Request Body:** N/A
- **Success Response:**
  - **Status Code:** `200 OK`
  - **Body:**
    ```json
    {
      "csrfToken": "abc123csrfTokenString..."
    }
    ```
- **Error Responses:**
  - **Status Code:** `500 Internal Server Error`
  - **Body:**
    ```json
    {
      "error": {
        "code": "INTERNAL_ERROR",
        "message": "Something went wrong. Please try again later."
      }
    }
    ```

---

### POST /api/auth/register

- **Description:** Registers a new user account with the default role of **Student**.
- **Authentication Required:** No
- **Role Required:** Any
- **Request Body:**
  ```json
  {
    "fullName": "String (required)",
    "email": "String (required, valid email address)",
    "password": "String (required, min 8 characters, at least 1 uppercase letter, at least 1 number)"
  }
  ```
- **Success Response:**
  - **Status Code:** `201 Created`
  - **Body:**
    ```json
    {
      "message": "Registration successful. Please log in."
    }
    ```
- **Error Responses:**
  - **Status Code:** `400 Bad Request`
    ```json
    {
      "error": {
        "code": "VALIDATION_ERROR",
        "message": "Password must be at least 8 characters."
      }
    }
    ```
  - **Status Code:** `409 Conflict`
    ```json
    {
      "error": {
        "code": "EMAIL_TAKEN",
        "message": "An account with this email already exists."
      }
    }
    ```

---

### POST /api/auth/login

- **Description:** Authenticates user credentials, sets an HttpOnly JWT cookie, and returns user profile details.
- **Authentication Required:** No
- **Role Required:** Any
- **Request Body:**
  ```json
  {
    "email": "String (required, valid email address)",
    "password": "String (required)"
  }
  ```
- **Success Response:**
  - **Status Code:** `200 OK`
  - **Body:**
    ```json
    {
      "role": "Student",
      "fullName": "Jane Doe"
    }
    ```
- **Error Responses:**
  - **Status Code:** `401 Unauthorized`
    ```json
    {
      "error": {
        "code": "INVALID_CREDENTIALS",
        "message": "The email or password you entered is incorrect."
      }
    }
    ```
  - **Status Code:** `403 Forbidden`
    ```json
    {
      "error": {
        "code": "ACCOUNT_DEACTIVATED",
        "message": "Your account has been deactivated. Contact your administrator."
      }
    }
    ```
  - **Status Code:** `403 Forbidden`
    ```json
    {
      "error": {
        "code": "ACCOUNT_LOCKED",
        "message": "Your account is locked due to too many failed attempts. Try again after 15 minutes."
      }
    }
    ```

---

### POST /api/auth/logout

- **Description:** Logs out the user by adding the active JWT token to the denylist database table and clearing the authentication cookie.
- **Authentication Required:** Yes
- **Role Required:** Student / Teacher / Admin (Any authenticated role)
- **Request Body:** N/A
- **Success Response:**
  - **Status Code:** `200 OK`
  - **Body:**
    ```json
    {
      "message": "Logged out successfully."
    }
    ```
- **Error Responses:**
  - **Status Code:** `401 Unauthorized`
    ```json
    {
      "error": {
        "code": "UNAUTHORIZED",
        "message": "Authentication required."
      }
    }
    ```

---

### POST /api/auth/forgot-password

- **Description:** Initiates password reset by generating a single-use token and emailing a password reset link to the user.
- **Authentication Required:** No
- **Role Required:** Any
- **Request Body:**
  ```json
  {
    "email": "String (required, valid email address)"
  }
  ```
- **Success Response:**
  - **Status Code:** `200 OK`
  - **Body:**
    ```json
    {
      "message": "If this email is registered, a reset link has been sent."
    }
    ```
- **Error Responses:**
  - **Status Code:** `400 Bad Request`
    ```json
    {
      "error": {
        "code": "VALIDATION_ERROR",
        "message": "A valid email address is required."
      }
    }
    ```

---

### POST /api/auth/reset-password

- **Description:** Resets user password using a valid, non-expired reset token.
- **Authentication Required:** No
- **Role Required:** Any
- **Request Body:**
  ```json
  {
    "token": "String (required, reset token from email)",
    "password": "String (required, min 8 characters, at least 1 uppercase letter, at least 1 number)"
  }
  ```
- **Success Response:**
  - **Status Code:** `200 OK`
  - **Body:**
    ```json
    {
      "message": "Password reset successfully. Please log in."
    }
    ```
- **Error Responses:**
  - **Status Code:** `400 Bad Request`
    ```json
    {
      "error": {
        "code": "INVALID_RESET_TOKEN",
        "message": "This reset link is invalid or has expired."
      }
    }
    ```

---

## QuestionBankModule

### GET /api/questions

- **Description:** Retrieves all question bank items created by the authenticated **Teacher**. Supports optional filtering by subject, topic, difficulty, or question type.
- **Authentication Required:** Yes
- **Role Required:** Teacher
- **Request Query Parameters:**
  - `subject` (optional string)
  - `topic` (optional string)
  - `difficulty` (optional string: `Easy`, `Medium`, `Hard`)
  - `type` (optional string: `MCQ_single`, `MCQ_multiple`, `TrueFalse`, `ShortAnswer`)
- **Request Body:** N/A
- **Success Response:**
  - **Status Code:** `200 OK`
  - **Body:**
    ```json
    {
      "questions": [
        {
          "id": 1,
          "type": "MCQ_single",
          "text": "What is the capital of France?",
          "options": "[\"Paris\", \"London\", \"Berlin\", \"Madrid\"]",
          "correct_answer": "\"Paris\"",
          "subject": "General Knowledge",
          "topic": "Geography",
          "difficulty": "Easy",
          "created_by": 2,
          "created_at": "2026-10-01T10:00:00.000Z",
          "updated_at": "2026-10-01T10:00:00.000Z"
        }
      ]
    }
    ```
- **Error Responses:**
  - **Status Code:** `401 Unauthorized`
    ```json
    {
      "error": {
        "code": "UNAUTHORIZED",
        "message": "Authentication required."
      }
    }
    ```
  - **Status Code:** `403 Forbidden`
    ```json
    {
      "error": {
        "code": "FORBIDDEN",
        "message": "Access denied. Required role: Teacher."
      }
    }
    ```

---

### POST /api/questions

- **Description:** Creates a new question in the question bank.
- **Authentication Required:** Yes
- **Role Required:** Teacher
- **Request Body:**
  ```json
  {
    "type": "String (required: MCQ_single | MCQ_multiple | TrueFalse | ShortAnswer)",
    "text": "String (required)",
    "options": "Array of Strings (optional for ShortAnswer, required for MCQ/TrueFalse)",
    "correctAnswer": "String or Array of Strings (required)",
    "subject": "String (required)",
    "topic": "String (required)",
    "difficulty": "String (required: Easy | Medium | Hard)"
  }
  ```
- **Success Response:**
  - **Status Code:** `201 Created`
  - **Body:**
    ```json
    {
      "message": "Question created successfully.",
      "questionId": 1
    }
    ```
- **Error Responses:**
  - **Status Code:** `400 Bad Request`
    ```json
    {
      "error": {
        "code": "VALIDATION_ERROR",
        "message": "Difficulty must be Easy, Medium, or Hard."
      }
    }
    ```
  - **Status Code:** `403 Forbidden`
    ```json
    {
      "error": {
        "code": "FORBIDDEN",
        "message": "Access denied. Required role: Teacher."
      }
    }
    ```

---

### PUT /api/questions/:id

- **Description:** Updates an existing question in the question bank. Cannot update questions associated with active or upcoming published exams.
- **Authentication Required:** Yes
- **Role Required:** Teacher
- **URL Parameters:**
  - `id`: Question ID (integer)
- **Request Body:**
  ```json
  {
    "type": "String (required: MCQ_single | MCQ_multiple | TrueFalse | ShortAnswer)",
    "text": "String (required)",
    "options": "Array of Strings (optional)",
    "correctAnswer": "String or Array of Strings (required)",
    "subject": "String (required)",
    "topic": "String (required)",
    "difficulty": "String (required: Easy | Medium | Hard)"
  }
  ```
- **Success Response:**
  - **Status Code:** `200 OK`
  - **Body:**
    ```json
    {
      "message": "Question updated successfully."
    }
    ```
- **Error Responses:**
  - **Status Code:** `404 Not Found`
    ```json
    {
      "error": {
        "code": "NOT_FOUND",
        "message": "Question not found."
      }
    }
    ```
  - **Status Code:** `409 Conflict`
    ```json
    {
      "error": {
        "code": "QUESTION_IN_ACTIVE_EXAM",
        "message": "This question cannot be edited because it is part of an active or upcoming exam."
      }
    }
    ```

---

### DELETE /api/questions/:id

- **Description:** Deletes a question from the question bank. Deletion is prohibited if the question is linked to an active or upcoming published exam.
- **Authentication Required:** Yes
- **Role Required:** Teacher
- **URL Parameters:**
  - `id`: Question ID (integer)
- **Request Body:** N/A
- **Success Response:**
  - **Status Code:** `200 OK`
  - **Body:**
    ```json
    {
      "message": "Question deleted successfully."
    }
    ```
- **Error Responses:**
  - **Status Code:** `404 Not Found`
    ```json
    {
      "error": {
        "code": "NOT_FOUND",
        "message": "Question not found."
      }
    }
    ```
  - **Status Code:** `409 Conflict`
    ```json
    {
      "error": {
        "code": "QUESTION_IN_ACTIVE_EXAM",
        "message": "This question cannot be deleted because it is part of an active or upcoming exam."
      }
    }
    ```

---

## ExamModule

### GET /api/exams

- **Description:** Lists exams. For **Teacher** users, returns all exams created by that teacher. For **Student** users, returns only published exams.
- **Authentication Required:** Yes
- **Role Required:** Teacher / Student
- **Request Body:** N/A
- **Success Response:**
  - **Status Code:** `200 OK`
  - **Body (Teacher):**
    ```json
    {
      "exams": [
        {
          "id": 1,
          "title": "Midterm Examination",
          "duration_minutes": 60,
          "start_datetime": "2026-10-10T09:00:00.000Z",
          "end_datetime": "2026-10-10T12:00:00.000Z",
          "shuffle": 1,
          "status": "published",
          "created_by": 2,
          "created_at": "2026-10-01T10:00:00.000Z",
          "total_marks": 100.00,
          "question_count": 20
        }
      ]
    }
    ```
- **Error Responses:**
  - **Status Code:** `401 Unauthorized`
    ```json
    {
      "error": {
        "code": "UNAUTHORIZED",
        "message": "Authentication required."
      }
    }
    ```

---

### GET /api/exams/:id

- **Description:** Retrieves details for a specific exam along with its associated questions and mark allocations.
- **Authentication Required:** Yes
- **Role Required:** Teacher / Student
- **URL Parameters:**
  - `id`: Exam ID (integer)
- **Request Body:** N/A
- **Success Response:**
  - **Status Code:** `200 OK`
  - **Body:**
    ```json
    {
      "exam": {
        "id": 1,
        "title": "Midterm Examination",
        "duration_minutes": 60,
        "start_datetime": "2026-10-10T09:00:00.000Z",
        "end_datetime": "2026-10-10T12:00:00.000Z",
        "shuffle": 1,
        "status": "published"
      },
      "questions": [
        {
          "id": 1,
          "type": "MCQ_single",
          "text": "What is the capital of France?",
          "options": "[\"Paris\", \"London\", \"Berlin\", \"Madrid\"]",
          "subject": "General Knowledge",
          "topic": "Geography",
          "difficulty": "Easy",
          "marks": 5.00
        }
      ]
    }
    ```
- **Error Responses:**
  - **Status Code:** `404 Not Found`
    ```json
    {
      "error": {
        "code": "NOT_FOUND",
        "message": "Exam not found."
      }
    }
    ```

---

### POST /api/exams

- **Description:** Creates a new exam in `draft` status with designated duration, start/end datetimes, shuffle setting, and question-mark allocations.
- **Authentication Required:** Yes
- **Role Required:** Teacher
- **Request Body:**
  ```json
  {
    "title": "String (required)",
    "durationMinutes": "Number (required, positive integer)",
    "startDatetime": "String (required, ISO8601 format)",
    "endDatetime": "String (required, ISO8601 format)",
    "shuffle": "Boolean (optional, default false)",
    "questions": [
      {
        "questionId": "Number (required)",
        "marks": "Number (required)"
      }
    ]
  }
  ```
- **Success Response:**
  - **Status Code:** `201 Created`
  - **Body:**
    ```json
    {
      "message": "Exam created successfully.",
      "examId": 1
    }
    ```
- **Error Responses:**
  - **Status Code:** `400 Bad Request`
    ```json
    {
      "error": {
        "code": "VALIDATION_ERROR",
        "message": "At least one question is required."
      }
    }
    ```

---

### PUT /api/exams/:id

- **Description:** Updates settings and question list for a `draft` status exam. Cannot modify published or closed exams.
- **Authentication Required:** Yes
- **Role Required:** Teacher
- **URL Parameters:**
  - `id`: Exam ID (integer)
- **Request Body:**
  ```json
  {
    "title": "String (required)",
    "durationMinutes": "Number (required, positive integer)",
    "startDatetime": "String (required, ISO8601 format)",
    "endDatetime": "String (required, ISO8601 format)",
    "shuffle": "Boolean (optional)",
    "questions": [
      {
        "questionId": "Number (required)",
        "marks": "Number (required)"
      }
    ]
  }
  ```
- **Success Response:**
  - **Status Code:** `200 OK`
  - **Body:**
    ```json
    {
      "message": "Exam updated successfully."
    }
    ```
- **Error Responses:**
  - **Status Code:** `404 Not Found`
    ```json
    {
      "error": {
        "code": "NOT_FOUND",
        "message": "Exam not found."
      }
    }
    ```
  - **Status Code:** `409 Conflict`
    ```json
    {
      "error": {
        "code": "EXAM_NOT_DRAFT",
        "message": "Only draft exams can be edited."
      }
    }
    ```

---

### PATCH /api/exams/:id/publish

- **Description:** Changes exam status from `draft` to `published`, making it accessible to students during its scheduled window.
- **Authentication Required:** Yes
- **Role Required:** Teacher
- **URL Parameters:**
  - `id`: Exam ID (integer)
- **Request Body:** N/A
- **Success Response:**
  - **Status Code:** `200 OK`
  - **Body:**
    ```json
    {
      "message": "Exam published successfully."
    }
    ```
- **Error Responses:**
  - **Status Code:** `400 Bad Request`
    ```json
    {
      "error": {
        "code": "NO_QUESTIONS",
        "message": "An exam must have at least one question before publishing."
      }
    }
    ```
  - **Status Code:** `409 Conflict`
    ```json
    {
      "error": {
        "code": "ALREADY_PUBLISHED",
        "message": "This exam has already been published."
      }
    }
    ```

---

## ExamTakingModule

### POST /api/attempt/start

- **Description:** Starts or resumes an exam attempt for a **Student**. Validates active window and prevents duplicate attempts. Returns questions, remaining server-authoritative timer, and saved answers if resuming.
- **Authentication Required:** Yes
- **Role Required:** Student
- **Request Body:**
  ```json
  {
    "examId": "Number (required)"
  }
  ```
- **Success Response:**
  - **Status Code:** `201 Created` (new attempt) or `200 OK` (resumed attempt)
  - **Body:**
    ```json
    {
      "attemptId": 10,
      "questions": [
        {
          "questionId": 1,
          "type": "MCQ_single",
          "text": "What is the capital of France?",
          "options": ["Paris", "London", "Berlin", "Madrid"],
          "marks": 5.00
        }
      ],
      "savedAnswers": [],
      "durationSeconds": 3600,
      "remainingSeconds": 3600,
      "serverTime": "2026-10-10T09:00:00.000Z"
    }
    ```
- **Error Responses:**
  - **Status Code:** `403 Forbidden`
    ```json
    {
      "error": {
        "code": "EXAM_NOT_STARTED",
        "message": "This exam has not started yet."
      }
    }
    ```
  - **Status Code:** `409 Conflict`
    ```json
    {
      "error": {
        "code": "ALREADY_SUBMITTED",
        "message": "You have already submitted this exam."
      }
    }
    ```

---

### POST /api/attempt/:id/autosave

- **Description:** Periodically auto-saves student draft responses for an ongoing exam attempt (called every 60 seconds by frontend client).
- **Authentication Required:** Yes
- **Role Required:** Student
- **URL Parameters:**
  - `id`: Attempt ID (integer)
- **Request Body:**
  ```json
  {
    "answers": [
      {
        "questionId": "Number (required)",
        "response": "String or JSON-encoded Array string"
      }
    ]
  }
  ```
- **Success Response:**
  - **Status Code:** `200 OK`
  - **Body:**
    ```json
    {
      "message": "Answers saved.",
      "savedAt": "2026-10-10T09:15:00.000Z"
    }
    ```
- **Error Responses:**
  - **Status Code:** `404 Not Found`
    ```json
    {
      "error": {
        "code": "NOT_FOUND",
        "message": "Attempt not found."
      }
    }
    ```
  - **Status Code:** `409 Conflict`
    ```json
    {
      "error": {
        "code": "ALREADY_SUBMITTED",
        "message": "This exam has already been submitted."
      }
    }
    ```

---

### POST /api/attempt/:id/submit

- **Description:** Finalizes and submits an exam attempt. Triggers immediate auto-grading for MCQ and True/False questions.
- **Authentication Required:** Yes
- **Role Required:** Student
- **URL Parameters:**
  - `id`: Attempt ID (integer)
- **Request Body:**
  ```json
  {
    "answers": [
      {
        "questionId": "Number (required)",
        "response": "String or JSON-encoded Array string"
      }
    ]
  }
  ```
- **Success Response:**
  - **Status Code:** `200 OK`
  - **Body:**
    ```json
    {
      "message": "Exam submitted successfully.",
      "submittedAt": "2026-10-10T09:45:00.000Z"
    }
    ```
- **Error Responses:**
  - **Status Code:** `403 Forbidden`
    ```json
    {
      "error": {
        "code": "EXAM_WINDOW_EXPIRED",
        "message": "The exam time window has expired."
      }
    }
    ```
  - **Status Code:** `409 Conflict`
    ```json
    {
      "error": {
        "code": "ALREADY_SUBMITTED",
        "message": "This exam has already been submitted."
      }
    }
    ```

---

## GradingModule

### GET /api/grading/:attemptId

- **Description:** Retrieves student attempt responses and auto-graded scores for manual grading by a **Teacher**.
- **Authentication Required:** Yes
- **Role Required:** Teacher
- **URL Parameters:**
  - `attemptId`: Attempt ID (integer)
- **Request Body:** N/A
- **Success Response:**
  - **Status Code:** `200 OK`
  - **Body:**
    ```json
    {
      "attempt": {
        "id": 10,
        "student_id": 5,
        "student_name": "Jane Doe",
        "exam_id": 1,
        "exam_title": "Midterm Examination",
        "status": "submitted"
      },
      "answers": [
        {
          "id": 25,
          "question_id": 3,
          "type": "ShortAnswer",
          "text": "Explain photosynthesis in brief.",
          "response": "Photosynthesis is the process by which plants convert light into chemical energy.",
          "auto_score": null,
          "manual_score": null,
          "max_marks": 10.00
        }
      ]
    }
    ```
- **Error Responses:**
  - **Status Code:** `404 Not Found`
    ```json
    {
      "error": {
        "code": "NOT_FOUND",
        "message": "Attempt not found."
      }
    }
    ```

---

### PATCH /api/grading/:attemptId

- **Description:** Saves teacher manual scores for short-answer questions and updates total attempt score.
- **Authentication Required:** Yes
- **Role Required:** Teacher
- **URL Parameters:**
  - `attemptId`: Attempt ID (integer)
- **Request Body:**
  ```json
  {
    "scores": [
      {
        "answerId": "Number (required)",
        "score": "Number (required)"
      }
    ]
  }
  ```
- **Success Response:**
  - **Status Code:** `200 OK`
  - **Body:**
    ```json
    {
      "message": "Scores saved successfully.",
      "totalScore": 85.50
    }
    ```
- **Error Responses:**
  - **Status Code:** `404 Not Found`
    ```json
    {
      "error": {
        "code": "NOT_FOUND",
        "message": "Attempt not found."
      }
    }
    ```

---

### PATCH /api/grading/:examId/release

- **Description:** Releases exam results for a specific exam, making scorecards visible to students.
- **Authentication Required:** Yes
- **Role Required:** Teacher
- **URL Parameters:**
  - `examId`: Exam ID (integer)
- **Request Body:** N/A
- **Success Response:**
  - **Status Code:** `200 OK`
  - **Body:**
    ```json
    {
      "message": "Results released to students successfully."
    }
    ```
- **Error Responses:**
  - **Status Code:** `404 Not Found`
    ```json
    {
      "error": {
        "code": "NOT_FOUND",
        "message": "Exam not found."
      }
    }
    ```

---

### GET /api/grading/results/:examId

- **Description:** Allows a **Student** to view their final score and exam evaluation after the teacher has released results.
- **Authentication Required:** Yes
- **Role Required:** Student
- **URL Parameters:**
  - `examId`: Exam ID (integer)
- **Request Body:** N/A
- **Success Response:**
  - **Status Code:** `200 OK`
  - **Body:**
    ```json
    {
      "result": {
        "id": 10,
        "total_score": 85.50,
        "submitted_at": "2026-10-10T09:45:00.000Z",
        "exam_title": "Midterm Examination",
        "total_marks": 100.00
      }
    }
    ```
- **Error Responses:**
  - **Status Code:** `403 Forbidden`
    ```json
    {
      "error": {
        "code": "RESULTS_NOT_RELEASED",
        "message": "Results have not been released yet."
      }
    }
    ```
  - **Status Code:** `404 Not Found`
    ```json
    {
      "error": {
        "code": "NOT_FOUND",
        "message": "No attempt found for this exam."
      }
    }
    ```

---

## AdminModule

### GET /api/admin/users

- **Description:** Lists all system user accounts with support for role filtering, active status filtering, and text search.
- **Authentication Required:** Yes
- **Role Required:** Admin
- **Request Query Parameters:**
  - `role` (optional string: `Student` | `Teacher` | `Admin`)
  - `is_active` (optional number: `1` | `0`)
  - `search` (optional string for matching name/email)
- **Request Body:** N/A
- **Success Response:**
  - **Status Code:** `200 OK`
  - **Body:**
    ```json
    {
      "users": [
        {
          "id": 1,
          "full_name": "System Admin",
          "email": "admin@oep.com",
          "role": "Admin",
          "is_active": 1,
          "created_at": "2026-10-01T00:00:00.000Z"
        }
      ]
    }
    ```
- **Error Responses:**
  - **Status Code:** `403 Forbidden`
    ```json
    {
      "error": {
        "code": "FORBIDDEN",
        "message": "Access denied. Required role: Admin."
      }
    }
    ```

---

### POST /api/admin/users

- **Description:** Creates a new user account with a specified role (`Student`, `Teacher`, or `Admin`).
- **Authentication Required:** Yes
- **Role Required:** Admin
- **Request Body:**
  ```json
  {
    "fullName": "String (required)",
    "email": "String (required, valid email address)",
    "password": "String (required, min 8 characters)",
    "role": "String (required: Student | Teacher | Admin)"
  }
  ```
- **Success Response:**
  - **Status Code:** `201 Created`
  - **Body:**
    ```json
    {
      "message": "User created successfully.",
      "userId": 4
    }
    ```
- **Error Responses:**
  - **Status Code:** `409 Conflict`
    ```json
    {
      "error": {
        "code": "EMAIL_TAKEN",
        "message": "An account with this email already exists."
      }
    }
    ```

---

### PATCH /api/admin/users/:id

- **Description:** Updates a user account's assigned role or active status. An admin cannot deactivate their own account.
- **Authentication Required:** Yes
- **Role Required:** Admin
- **URL Parameters:**
  - `id`: User ID (integer)
- **Request Body:**
  ```json
  {
    "role": "String (optional: Student | Teacher | Admin)",
    "isActive": "Boolean (optional)"
  }
  ```
- **Success Response:**
  - **Status Code:** `200 OK`
  - **Body:**
    ```json
    {
      "message": "User updated successfully."
    }
    ```
- **Error Responses:**
  - **Status Code:** `400 Bad Request`
    ```json
    {
      "error": {
        "code": "SELF_DEACTIVATE",
        "message": "You cannot deactivate your own account."
      }
    }
    ```
  - **Status Code:** `404 Not Found`
    ```json
    {
      "error": {
        "code": "NOT_FOUND",
        "message": "User not found."
      }
    }
    ```

---

### DELETE /api/admin/users/:id

- **Description:** Deletes a user account from the system. An admin cannot delete their own account.
- **Authentication Required:** Yes
- **Role Required:** Admin
- **URL Parameters:**
  - `id`: User ID (integer)
- **Request Body:** N/A
- **Success Response:**
  - **Status Code:** `200 OK`
  - **Body:**
    ```json
    {
      "message": "User deleted successfully."
    }
    ```
- **Error Responses:**
  - **Status Code:** `400 Bad Request`
    ```json
    {
      "error": {
        "code": "SELF_DELETE",
        "message": "You cannot delete your own account."
      }
    }
    ```
  - **Status Code:** `404 Not Found`
    ```json
    {
      "error": {
        "code": "NOT_FOUND",
        "message": "User not found."
      }
    }
    ```

---

### GET /api/admin/dashboard

- **Description:** Provides system health metrics, active exam session details, uptime, and user account breakdown by role.
- **Authentication Required:** Yes
- **Role Required:** Admin
- **Request Body:** N/A
- **Success Response:**
  - **Status Code:** `200 OK`
  - **Body:**
    ```json
    {
      "systemHealth": {
        "status": "ok",
        "uptime": 12345.67
      },
      "activeExamCount": 2,
      "activeExams": [
        {
          "id": 1,
          "title": "Midterm Examination",
          "students_currently_taking": 15
        }
      ],
      "userCounts": {
        "students": 120,
        "teachers": 10,
        "admins": 2,
        "deactivated": 1
      },
      "timestamp": "2026-10-07T15:00:00.000Z"
    }
    ```
- **Error Responses:**
  - **Status Code:** `403 Forbidden`
    ```json
    {
      "error": {
        "code": "FORBIDDEN",
        "message": "Access denied. Required role: Admin."
      }
    }
    ```

---

## Health

### GET /api/health

- **Description:** Public health check endpoint that tests database connectivity, checks system uptime, and reports active exam count.
- **Authentication Required:** No
- **Role Required:** Any
- **Request Body:** N/A
- **Success Response:**
  - **Status Code:** `200 OK`
  - **Body:**
    ```json
    {
      "status": "ok",
      "uptime": 12345.67,
      "activeExamSessions": 2,
      "timestamp": "2026-10-07T15:00:00.000Z"
    }
    ```
- **Error Responses:**
  - **Status Code:** `500 Internal Server Error`
  - **Body:**
    ```json
    {
      "status": "degraded",
      "message": "Database unreachable"
    }
    ```
