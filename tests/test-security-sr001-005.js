
/**
 * Security and Concurrency Automated Test Suite
 *
 * Requirements:
 * OEP-SR-001: HTTPS and TLS 1.2+
 * OEP-SR-002: Password hashing using bcrypt
 * OEP-SR-003: JWT invalidation after logout
 * OEP-SR-004: SQL injection and input validation
 * OEP-SR-005: CSRF protection
 * OEP-NF-003: Concurrent session handling
 */

require('dotenv').config();

const https = require('https');
const http = require('http');
const tls = require('tls');
const bcrypt = require('bcrypt');
const pool = require('../backend/config/db');

const BASE_URL = process.env.APP_URL || 'http://localhost:3000';
const HTTPS_TEST_URL = process.env.HTTPS_TEST_URL;
const HTTP_TEST_URL = process.env.HTTP_TEST_URL;

let passed = 0;
let skipped = 0;

class SessionClient {
  constructor() {
    this.cookies = new Map();
  }

  updateCookies(res) {
    let raw = [];

    if (typeof res.headers.getSetCookie === 'function') {
      raw = res.headers.getSetCookie();
    } else {
      const header = res.headers.get('set-cookie');
      if (header) raw = [header];
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

    if (cookie) {
      headers.Cookie = cookie;
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    this.updateCookies(response);
    return response;
  }
}

function pass(message) {
  passed++;
  console.log(`PASS: ${message}`);
}

function skip(message) {
  skipped++;
  console.log(`SKIP: ${message}`);
}

async function getCsrf(client) {
  const response = await client.fetch(
    `${BASE_URL}/api/auth/csrf-token`
  );

  const data = await response.json();

  if (!response.ok || !data.csrfToken) {
    throw new Error('Unable to obtain CSRF token.');
  }

  return data.csrfToken;
}

function checkHttps(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true
      },
      response => {
        const protocol = response.socket.getProtocol();

        response.resume();

        response.on('end', () => {
          resolve({
            status: response.statusCode,
            protocol
          });
        });
      }
    );

    request.setTimeout(10000, () => {
      request.destroy(new Error('HTTPS request timed out.'));
    });

    request.on('error', reject);
  });
}

function checkHttpRedirect(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, response => {
      const result = {
        status: response.statusCode,
        location: response.headers.location
      };

      response.resume();

      response.on('end', () => resolve(result));
    });

    request.setTimeout(10000, () => {
      request.destroy(new Error('HTTP redirect request timed out.'));
    });

    request.on('error', reject);
  });
}

async function testHttpsTls() {
  console.log('\n[TEST SR-001] HTTPS and TLS verification');

  if (!HTTPS_TEST_URL) {
    skip(
      'OEP-SR-001: HTTPS_TEST_URL not configured. Live TLS verification requires a deployed HTTPS endpoint.'
    );
    return;
  }

  if (!HTTPS_TEST_URL.startsWith('https://')) {
    throw new Error('HTTPS_TEST_URL must start with https://');
  }

  const result = await checkHttps(HTTPS_TEST_URL);

  if (!result.protocol) {
    throw new Error('TLS protocol could not be determined.');
  }

  const supportedProtocols = ['TLSv1.2', 'TLSv1.3'];

  if (!supportedProtocols.includes(result.protocol)) {
    throw new Error(
      `Insecure or unsupported TLS protocol negotiated: ${result.protocol}`
    );
  }

  pass(`HTTPS connection established using ${result.protocol}.`);

  if (HTTP_TEST_URL) {
    if (!HTTP_TEST_URL.startsWith('http://')) {
      throw new Error('HTTP_TEST_URL must start with http://');
    }

    const redirect = await checkHttpRedirect(HTTP_TEST_URL);

    if (![301, 302, 307, 308].includes(redirect.status)) {
      throw new Error(
        `Expected HTTP to redirect to HTTPS. Received status ${redirect.status}.`
      );
    }

    if (
      !redirect.location ||
      !redirect.location.startsWith('https://')
    ) {
      throw new Error(
        'HTTP redirect did not point to an HTTPS URL.'
      );
    }

    pass('HTTP requests redirect to HTTPS.');
  } else {
    skip(
      'HTTP-to-HTTPS redirect test skipped: HTTP_TEST_URL not configured.'
    );
  }
}

async function testPasswordHashing() {
  console.log('\n[TEST SR-002] Password hashing');

  const [users] = await pool.query(
    'SELECT email, password_hash FROM users'
  );

  if (users.length === 0) {
    throw new Error('No users available for password hashing verification.');
  }

  for (const user of users) {
    if (
      !user.password_hash.startsWith('$2b$') &&
      !user.password_hash.startsWith('$2a$')
    ) {
      throw new Error(
        `Password for ${user.email} is not a valid bcrypt hash.`
      );
    }

    const rounds = parseInt(
      user.password_hash.split('$')[2],
      10
    );

    if (rounds < 10) {
      throw new Error(
        `Bcrypt cost factor for ${user.email} is below 10.`
      );
    }
  }

  pass(
    `All ${users.length} user passwords use bcrypt with cost factor >= 10.`
  );
}

async function testCsrf() {
  console.log('\n[TEST SR-005] CSRF protection');

  const response = await fetch(
    `${BASE_URL}/api/auth/login`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'admin@oep.com',
        password: 'Admin@123'
      })
    }
  );

  const data = await response.json();

  if (
    response.status !== 403 ||
    data.error?.code !== 'INVALID_CSRF_TOKEN'
  ) {
    throw new Error(
      `Expected 403 INVALID_CSRF_TOKEN, received ${response.status}.`
    );
  }

  pass('Mutating requests without CSRF tokens are rejected.');
}

async function testJwtInvalidation() {
  console.log('\n[TEST SR-003] JWT invalidation after logout');

  const client = new SessionClient();

  let csrf = await getCsrf(client);

  const loginResponse = await client.fetch(
    `${BASE_URL}/api/auth/login`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrf
      },
      body: JSON.stringify({
        email: 'student@test.com',
        password: 'Student@123'
      })
    }
  );

  if (!loginResponse.ok) {
    throw new Error(
      `Student login failed: ${loginResponse.status}`
    );
  }

  const savedToken = client.cookies.get('token');

  if (!savedToken) {
    throw new Error('Authentication cookie was not received.');
  }

  csrf = await getCsrf(client);

  const logoutResponse = await client.fetch(
    `${BASE_URL}/api/auth/logout`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrf
      }
    }
  );

  if (!logoutResponse.ok) {
    throw new Error(
      `Logout failed: ${logoutResponse.status}`
    );
  }

  const oldTokenClient = new SessionClient();

  oldTokenClient.cookies.set('token', savedToken);

  const reuseCsrf = await getCsrf(oldTokenClient);

  const reuseResponse = await oldTokenClient.fetch(
    `${BASE_URL}/api/attempt/start`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': reuseCsrf
      },
      body: JSON.stringify({
        examId: 2
      })
    }
  );

  const data = await reuseResponse.json();

  if (
    reuseResponse.status !== 401 ||
    data.error?.code !== 'TOKEN_INVALIDATED'
  ) {
    throw new Error(
      `Old JWT was not invalidated correctly. Received ${reuseResponse.status}.`
    );
  }

  pass('Previously issued JWT is rejected after logout.');
}

async function testInputValidation() {
  console.log('\n[TEST SR-004] SQL injection protection');

  const client = new SessionClient();
  const csrf = await getCsrf(client);

  const response = await client.fetch(
    `${BASE_URL}/api/auth/login`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrf
      },
      body: JSON.stringify({
        email: "' OR '1'='1' --",
        password: "' OR '1'='1"
      })
    }
  );

  if (![400, 401].includes(response.status)) {
    throw new Error(
      `Unexpected SQL injection test response: ${response.status}`
    );
  }

  pass('SQL injection payload is rejected without SQL error.');
}

async function testConcurrency() {
  console.log('\n[TEST NF-003] Concurrent request handling');

  const requests = Array.from(
    { length: 50 },
    () => fetch(`${BASE_URL}/api/health`)
  );

  const responses = await Promise.all(requests);

  const failed = responses.filter(
    response => response.status !== 200
  );

  if (failed.length > 0) {
    throw new Error(
      `${failed.length} out of 50 concurrent requests failed.`
    );
  }

  pass('50 concurrent health requests returned HTTP 200.');
}

async function run() {
  console.log('================================================');
  console.log(' SECURITY AND CONCURRENCY TEST SUITE');
  console.log('================================================');

  try {
    await testHttpsTls();
    await testPasswordHashing();
    await testCsrf();
    await testJwtInvalidation();
    await testInputValidation();
    await testConcurrency();

    console.log('\n================================================');
    console.log(' TEST EXECUTION SUMMARY');
    console.log(` PASSED: ${passed}`);
    console.log(` SKIPPED: ${skipped}`);
    console.log(' FAILED: 0');
    console.log('================================================');

    if (skipped > 0) {
      console.log(
        '\nSome checks require deployment configuration before full verification.'
      );
    } else {
      console.log('\nAll configured checks completed successfully.');
    }

  } catch (error) {
    console.error('\nTEST FAILED:', error.message);
    process.exitCode = 1;

  } finally {
    await pool.end();
  }
}

run();
