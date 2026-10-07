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
