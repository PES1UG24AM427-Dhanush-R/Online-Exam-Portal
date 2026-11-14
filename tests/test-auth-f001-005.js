
/**
 * Automated Authentication Test Suite
 * Requirements: OEP-F-001 to OEP-F-005
 *
 * Covers:
 * F-001: Student registration and duplicate email prevention
 * F-002: Login and JWT HttpOnly cookie issuance
 * F-003: Account lockout after 5 failed login attempts
 * F-004: Server-side role-based access control
 * F-005: Password reset token expiry and single-use enforcement
 */

require('dotenv').config();

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const pool = require('../backend/config/db');

const BASE_URL = process.env.APP_URL || 'http://localhost:3000';
const TEST_PASSWORD = 'TestAuth@123';
const RESET_PASSWORD = 'NewAuth@456';

class SessionClient {
  constructor() {
    this.cookies = new Map();
  }

  updateCookies(res) {
    let raw = [];

    if (typeof res.headers.getSetCookie === 'function') {
      raw = res.headers.getSetCookie();
    } else {
      const cookie = res.headers.get('set-cookie');
      if (cookie) raw = [cookie];
    }

    for (const cookie of raw) {
      const parts = cookie.split(';')[0].split('=');

      if (parts.length >= 2) {
        this.cookies.set(
          parts[0].trim(),
          parts.slice(1).join('=').trim()
        );
      }
    }
  }

  getCookieHeader() {
    return Array.from(this.cookies.entries())
      .map(([key, value]) => `${key}=${value}`)
      .join('; ');
  }

  async fetch(url, options = {}) {
    const headers = { ...(options.headers || {}) };
    const cookie = this.getCookieHeader();

    if (cookie) headers.Cookie = cookie;

    const response = await fetch(url, {
      ...options,
      headers
    });

    this.updateCookies(response);
    return response;
  }
}

async function getCsrfToken(client) {
  const response = await client.fetch(
    `${BASE_URL}/api/auth/csrf-token`
  );

  if (!response.ok) {
    throw new Error(`CSRF request failed: ${response.status}`);
  }

  const data = await response.json();

  if (!data.csrfToken) {
    throw new Error('CSRF token was not returned.');
  }

  return data.csrfToken;
}

async function postWithCsrf(client, endpoint, body) {
  const csrfToken = await getCsrfToken(client);

  return client.fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken
    },
    body: JSON.stringify(body)
  });
}

async function run() {
  console.log('================================================');
  console.log(' AUTHENTICATION TEST SUITE: OEP-F-001 TO F-005');
  console.log('================================================\n');

  const unique = crypto.randomUUID().replace(/-/g, '');
  const studentEmail = `auth-test-${unique}@example.com`;
  const lockoutEmail = `lockout-test-${unique}@example.com`;

  let studentId = null;
  let lockoutUserId = null;

  try {
    // ------------------------------------------------
    // TEST 1: OEP-F-001 - Student Registration
    // ------------------------------------------------

    console.log('[TEST 1] OEP-F-001: Student Registration');

    const registrationClient = new SessionClient();

    const registerResponse = await postWithCsrf(
      registrationClient,
      '/api/auth/register',
      {
        fullName: 'Authentication Test Student',
        email: studentEmail,
        password: TEST_PASSWORD
      }
    );

    const registerData = await registerResponse.json();

    if (registerResponse.status !== 201) {
      throw new Error(
        `Registration failed: ${JSON.stringify(registerData)}`
      );
    }

    const [registeredUsers] = await pool.query(
      'SELECT id, full_name, email, role, password_hash FROM users WHERE email = ?',
      [studentEmail]
    );

    if (registeredUsers.length !== 1) {
      throw new Error('Registered user was not found in database.');
    }

    studentId = registeredUsers[0].id;

    if (registeredUsers[0].role !== 'Student') {
      throw new Error('Self-registration did not create a Student account.');
    }

    const passwordIsHashed = await bcrypt.compare(
      TEST_PASSWORD,
      registeredUsers[0].password_hash
    );

    if (!passwordIsHashed) {
      throw new Error('Registered password does not match its stored hash.');
    }

    console.log('  PASS: Student registration successful.');
    console.log('  PASS: Account stored with Student role.');
    console.log('  PASS: Password stored as a bcrypt hash.');

    // Duplicate registration must be rejected.

    const duplicateResponse = await postWithCsrf(
      registrationClient,
      '/api/auth/register',
      {
        fullName: 'Duplicate Test Student',
        email: studentEmail,
        password: TEST_PASSWORD
      }
    );

    const duplicateData = await duplicateResponse.json();

    if (
      duplicateResponse.status !== 409 ||
      duplicateData.error?.code !== 'EMAIL_TAKEN'
    ) {
      throw new Error(
        `Duplicate registration was not rejected correctly: ${JSON.stringify(duplicateData)}`
      );
    }

    console.log('  PASS: Duplicate email rejected with HTTP 409.');

    // Invalid password must be rejected.

    const invalidPasswordResponse = await postWithCsrf(
      registrationClient,
      '/api/auth/register',
      {
        fullName: 'Invalid Password Student',
        email: `invalid-${unique}@example.com`,
        password: 'weak'
      }
    );

    if (invalidPasswordResponse.status !== 400) {
      throw new Error(
        `Expected HTTP 400 for weak password, got ${invalidPasswordResponse.status}`
      );
    }

    console.log('  PASS: Weak password rejected with HTTP 400.\n');

    // ------------------------------------------------
    // TEST 2: OEP-F-002 - Login and JWT Cookie
    // ------------------------------------------------

    console.log('[TEST 2] OEP-F-002: Login and JWT Issuance');

    const loginClient = new SessionClient();

    const loginResponse = await postWithCsrf(
      loginClient,
      '/api/auth/login',
      {
        email: studentEmail,
        password: TEST_PASSWORD
      }
    );

    const loginData = await loginResponse.json();

    if (loginResponse.status !== 200) {
      throw new Error(
        `Login failed: ${JSON.stringify(loginData)}`
      );
    }

    if (loginData.role !== 'Student') {
      throw new Error(`Unexpected login role: ${loginData.role}`);
    }

    if (!loginClient.cookies.has('token')) {
      throw new Error('JWT token cookie was not issued.');
    }

    const [loginCookie] = await pool.query(
      'SELECT failed_attempts, lockout_until FROM users WHERE id = ?',
      [studentId]
    );

    if (
      loginCookie[0].failed_attempts !== 0 ||
      loginCookie[0].lockout_until !== null
    ) {
      throw new Error('Successful login did not reset failed login counters.');
    }

    console.log('  PASS: Valid Student login returned HTTP 200.');
    console.log('  PASS: JWT token cookie issued.');
    console.log('  PASS: Login response contains the correct role.');
    console.log('  PASS: Failed login counters reset.\n');

    // ------------------------------------------------
    // TEST 3: OEP-F-003 - Account Lockout
    // ------------------------------------------------

    console.log('[TEST 3] OEP-F-003: Account Lockout');

    const lockoutRegistrationClient = new SessionClient();

    const lockoutRegisterResponse = await postWithCsrf(
      lockoutRegistrationClient,
      '/api/auth/register',
      {
        fullName: 'Lockout Test Student',
        email: lockoutEmail,
        password: TEST_PASSWORD
      }
    );

    if (lockoutRegisterResponse.status !== 201) {
      throw new Error('Could not create temporary lockout test account.');
    }

    const [lockoutUsers] = await pool.query(
      'SELECT id FROM users WHERE email = ?',
      [lockoutEmail]
    );

    lockoutUserId = lockoutUsers[0].id;

    const lockoutClient = new SessionClient();

    for (let attempt = 1; attempt <= 5; attempt++) {
      const response = await postWithCsrf(
        lockoutClient,
        '/api/auth/login',
        {
          email: lockoutEmail,
          password: 'WrongPassword@123'
        }
      );

      const data = await response.json();

      if (attempt < 5 && response.status !== 401) {
        throw new Error(
          `Failed login ${attempt} should return 401, got ${response.status}`
        );
      }

      if (attempt === 5) {
        if (
          response.status !== 403 ||
          data.error?.code !== 'ACCOUNT_LOCKED'
        ) {
          throw new Error(
            `Fifth failed login did not trigger lockout: ${JSON.stringify(data)}`
          );
        }
      }

      console.log(`  Failed login attempt ${attempt}: HTTP ${response.status}`);
    }

    const [lockoutState] = await pool.query(
      'SELECT failed_attempts, lockout_until FROM users WHERE id = ?',
      [lockoutUserId]
    );

    if (
      lockoutState[0].failed_attempts < 5 ||
      !lockoutState[0].lockout_until
    ) {
      throw new Error('Database does not show the expected lockout state.');
    }

    const blockedLogin = await postWithCsrf(
      lockoutClient,
      '/api/auth/login',
      {
        email: lockoutEmail,
        password: TEST_PASSWORD
      }
    );

    const blockedData = await blockedLogin.json();

    if (
      blockedLogin.status !== 403 ||
      blockedData.error?.code !== 'ACCOUNT_LOCKED'
    ) {
      throw new Error('Correct password was accepted during account lockout.');
    }

    console.log('  PASS: Account locked after five failed attempts.');
    console.log('  PASS: Lockout timestamp recorded in database.');
    console.log('  PASS: Correct password rejected during lockout.\n');

    // ------------------------------------------------
    // TEST 4: OEP-F-004 - Server-Side RBAC
    // ------------------------------------------------

    console.log('[TEST 4] OEP-F-004: Role-Based Access Control');

    const teacherEndpointResponse = await loginClient.fetch(
      `${BASE_URL}/api/questions`
    );

    const teacherEndpointData = await teacherEndpointResponse.json();

    if (
      teacherEndpointResponse.status !== 403
    ) {
      throw new Error(
        `Student accessed Teacher-only endpoint. Status: ${teacherEndpointResponse.status}`
      );
    }

    console.log('  PASS: Student denied access to Teacher-only question bank.');
    console.log('  PASS: Server returned HTTP 403.\n');

    // ------------------------------------------------
    // TEST 5: OEP-F-005 - Password Reset
    // ------------------------------------------------

    console.log('[TEST 5] OEP-F-005: Password Reset Token');

    const validResetToken = crypto.randomUUID();
    const validExpiry = new Date(Date.now() + 60 * 60 * 1000);

    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at, used) VALUES (?, ?, ?, 0)',
      [studentId, validResetToken, validExpiry]
    );

    // Reset using a valid token.

    const resetClient = new SessionClient();

    const resetResponse = await postWithCsrf(
      resetClient,
      '/api/auth/reset-password',
      {
        token: validResetToken,
        password: RESET_PASSWORD
      }
    );

    const resetData = await resetResponse.json();

    if (resetResponse.status !== 200) {
      throw new Error(
        `Valid password reset failed: ${JSON.stringify(resetData)}`
      );
    }

    const [resetTokenRows] = await pool.query(
      'SELECT used FROM password_reset_tokens WHERE token = ?',
      [validResetToken]
    );

    if (resetTokenRows[0].used !== 1) {
      throw new Error('Password reset token was not marked as used.');
    }

    const [updatedUsers] = await pool.query(
      'SELECT password_hash FROM users WHERE id = ?',
      [studentId]
    );

    const newPasswordWorks = await bcrypt.compare(
      RESET_PASSWORD,
      updatedUsers[0].password_hash
    );

    if (!newPasswordWorks) {
      throw new Error('New password was not saved correctly.');
    }

    console.log('  PASS: Valid reset token successfully changed password.');
    console.log('  PASS: Reset token marked as used.');

    // Reuse the same token.

    const reuseResponse = await postWithCsrf(
      resetClient,
      '/api/auth/reset-password',
      {
        token: validResetToken,
        password: 'AnotherAuth@789'
      }
    );

    const reuseData = await reuseResponse.json();

    if (
      reuseResponse.status !== 400 ||
      reuseData.error?.code !== 'INVALID_RESET_TOKEN'
    ) {
      throw new Error('Previously used reset token was accepted.');
    }

    console.log('  PASS: Reused reset token rejected.');

    // Expired token.

    const expiredResetToken = crypto.randomUUID();
    const expiredDate = new Date(Date.now() - 60 * 60 * 1000);

    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at, used) VALUES (?, ?, ?, 0)',
      [studentId, expiredResetToken, expiredDate]
    );

    const expiredResponse = await postWithCsrf(
      resetClient,
      '/api/auth/reset-password',
      {
        token: expiredResetToken,
        password: 'ExpiredAuth@789'
      }
    );

    const expiredData = await expiredResponse.json();

    if (
      expiredResponse.status !== 400 ||
      expiredData.error?.code !== 'INVALID_RESET_TOKEN'
    ) {
      throw new Error('Expired reset token was accepted.');
    }

    console.log('  PASS: Expired reset token rejected.');

    // Verify the new password works for login.

    const newLoginClient = new SessionClient();

    const newLoginResponse = await postWithCsrf(
      newLoginClient,
      '/api/auth/login',
      {
        email: studentEmail,
        password: RESET_PASSWORD
      }
    );

    if (newLoginResponse.status !== 200) {
      throw new Error('Login with the newly reset password failed.');
    }

    console.log('  PASS: Login works with the new password.\n');

    console.log('================================================');
    console.log(' ALL AUTHENTICATION TESTS PASSED');
    console.log(' OEP-F-001 to OEP-F-005');
    console.log('================================================');

  } catch (error) {
    console.error('\n>>> TEST FAILED:', error.message);
    process.exitCode = 1;

  } finally {
    // Remove temporary test accounts and their related records.
    try {
      const ids = [studentId, lockoutUserId].filter(Boolean);

      if (ids.length > 0) {
        const placeholders = ids.map(() => '?').join(', ');

        await pool.query(
          `DELETE FROM audit_logs WHERE user_id IN (${placeholders})`,
          ids
        );

        await pool.query(
          `DELETE FROM password_reset_tokens WHERE user_id IN (${placeholders})`,
          ids
        );

        await pool.query(
          `DELETE FROM users WHERE id IN (${placeholders})`,
          ids
        );

        console.log('\nTemporary authentication test accounts cleaned up.');
      }
    } catch (cleanupError) {
      console.error(
        'Warning: Test account cleanup failed:',
        cleanupError.message
      );
      process.exitCode = 1;
    }

    await pool.end();
  }
}

run();
