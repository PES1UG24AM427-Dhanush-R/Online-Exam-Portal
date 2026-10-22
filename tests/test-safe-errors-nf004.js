/**
 * Automated Verification Test for OEP-NF-004: Safe Error Messages
 *
 * Test Case Traceability: STP TC-UX-01 / SRS OEP-NF-004
 *
 * Verifies:
 * 1. Step 1: Submit invalid login credentials -> Safe 401 response without leaking details.
 * 2. Step 2: Submit invalid form data -> Safe 400 validation response without internal details.
 * 3. Step 3: Attempt to access unauthorized resource -> Safe 401/403 response.
 * 4. Step 4: Send malformed JSON to API -> Safe 400 response without stack trace or file paths.
 * 5. Step 5: Query non-existent API endpoint -> Safe 404 response without directory listing or stack trace.
 * 6. Validates absence of sensitive internal signatures (stack traces, SQL syntax, server file paths).
 */

require('dotenv').config();

const BASE_URL = process.env.APP_URL || 'http://localhost:3000';

function inspectForLeaks(bodyText, testName) {
  const leaks = [];

  // Check for stack trace patterns
  if (bodyText.includes('    at ') || bodyText.includes('node:internal')) {
    leaks.push('Node.js stack trace detected');
  }

  // Check for database errors
  if (/ER_[A-Z_]+/.test(bodyText) || bodyText.includes('SQL syntax') || bodyText.toLowerCase().includes('mysql')) {
    leaks.push('Database internal error / SQL signature detected');
  }

  // Check for server file paths
  if (/[a-zA-Z]:\\[\\\S]+/.test(bodyText) || /\/(?:home|usr|var|etc|app)\//.test(bodyText)) {
    leaks.push('Server absolute file path detected');
  }

  if (leaks.length > 0) {
    throw new Error(`[${testName}] Leaked internal details: ${leaks.join(', ')} | Response: ${bodyText}`);
  }
}

async function run() {
  console.log('=== Starting Test: OEP-NF-004 (TC-UX-01 User-Facing Error Messages) ===\n');

  try {
    // 1. Get CSRF Token
    const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf-token`);
    const csrfData = await csrfRes.json();
    const csrfToken = csrfData.csrfToken;
    const cookies = csrfRes.headers.get('set-cookie') || '';
    const cookieHeader = cookies.split(';')[0];

    // Step 1: Submit invalid login credentials
    console.log('[Step 1] Submitting invalid login credentials...');
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
        'Cookie': cookieHeader,
      },
      body: JSON.stringify({ email: 'nonexistent@test.com', password: 'WrongPassword123' }),
    });
    const loginText = await loginRes.text();
    inspectForLeaks(loginText, 'Invalid Login');
    const loginData = JSON.parse(loginText);
    if (loginRes.status !== 401 || !loginData.error?.message) {
      throw new Error(`Unexpected response for invalid login: ${loginRes.status}`);
    }
    console.log('  -> Status:', loginRes.status, '| Error message:', loginData.error.message, '✓ Safe');

    // Step 2: Submit invalid form data (malformed email, short password)
    console.log('[Step 2] Submitting invalid registration form data...');
    const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
        'Cookie': cookieHeader,
      },
      body: JSON.stringify({ fullName: '', email: 'not-an-email', password: '123' }),
    });
    const regText = await regRes.text();
    inspectForLeaks(regText, 'Invalid Registration');
    const regData = JSON.parse(regText);
    if (regRes.status !== 400 || regData.error?.code !== 'VALIDATION_ERROR') {
      throw new Error(`Unexpected response for invalid registration: ${regRes.status}`);
    }
    console.log('  -> Status:', regRes.status, '| Error code:', regData.error.code, '| Message:', regData.error.message, '✓ Safe');

    // Step 3: Attempt to access protected endpoint without auth token
    console.log('[Step 3] Accessing protected endpoint without authentication...');
    const unauthRes = await fetch(`${BASE_URL}/api/attempt/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
        'Cookie': cookieHeader,
      },
      body: JSON.stringify({ examId: 1 }),
    });
    const unauthText = await unauthRes.text();
    inspectForLeaks(unauthText, 'Unauthorized Access');
    const unauthData = JSON.parse(unauthText);
    if (unauthRes.status !== 401 || unauthData.error?.code !== 'NO_TOKEN') {
      throw new Error(`Unexpected response for unauthorized access: ${unauthRes.status}`);
    }
    console.log('  -> Status:', unauthRes.status, '| Error code:', unauthData.error.code, '| Message:', unauthData.error.message, '✓ Safe');

    // Step 4: Send malformed JSON payload to an API endpoint
    console.log('[Step 4] Sending malformed JSON payload to API...');
    const malformedRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
        'Cookie': cookieHeader,
      },
      body: '{ this is invalid json ;;; ',
    });
    const malformedText = await malformedRes.text();
    inspectForLeaks(malformedText, 'Malformed JSON');
    const malformedData = JSON.parse(malformedText);
    if (malformedRes.status !== 400 || malformedData.error?.code !== 'BAD_REQUEST') {
      throw new Error(`Unexpected response for malformed JSON: ${malformedRes.status}`);
    }
    console.log('  -> Status:', malformedRes.status, '| Error code:', malformedData.error.code, '| Message:', malformedData.error.message, '✓ Safe');

    // Step 5: Request non-existent API route
    console.log('[Step 5] Requesting non-existent API route...');
    const notFoundRes = await fetch(`${BASE_URL}/api/nonexistent-endpoint`);
    const notFoundText = await notFoundRes.text();
    inspectForLeaks(notFoundText, 'Unknown Route');
    const notFoundData = JSON.parse(notFoundText);
    if (notFoundRes.status !== 404 || notFoundData.error?.code !== 'NOT_FOUND') {
      throw new Error(`Unexpected response for non-existent route: ${notFoundRes.status}`);
    }
    console.log('  -> Status:', notFoundRes.status, '| Error code:', notFoundData.error.code, '| Message:', notFoundData.error.message, '✓ Safe');

    console.log('\n>>> SUCCESS: TC-UX-01 / OEP-NF-004 PASSED! All error messages are safe, non-technical, and free of leaks.\n');
    process.exit(0);
  } catch (err) {
    console.error('\n>>> TEST FAILED:', err.message);
    process.exit(1);
  }
}

run();
