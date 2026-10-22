/**
 * Automated Verification Test for OEP-F-019 & OEP-F-020 (Admin Module)
 *
 * Traceability:
 * - OEP-F-019 / TC-Admin-01: Admin User Management
 * - OEP-F-020 / TC-Admin-02: Admin Dashboard System Health
 */

require('dotenv').config();
const pool = require('../backend/config/db');

const BASE_URL = process.env.APP_URL || 'http://localhost:3000';

class SessionClient {
  constructor() {
    this.cookies = new Map();
  }

  updateCookies(res) {
    let raw = [];
    if (typeof res.headers.getSetCookie === 'function') {
      raw = res.headers.getSetCookie();
    } else {
      const h = res.headers.get('set-cookie');
      if (h) raw = [h];
    }
    for (const c of raw) {
      const parts = c.split(';')[0].split('=');
      if (parts.length >= 2) {
        this.cookies.set(parts[0].trim(), parts.slice(1).join('=').trim());
      }
    }
  }

  getCookieHeader() {
    return Array.from(this.cookies.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
  }

  async fetch(url, options = {}) {
    options.headers = options.headers || {};
    const cookie = this.getCookieHeader();
    if (cookie) options.headers['Cookie'] = cookie;
    const res = await fetch(url, options);
    this.updateCookies(res);
    return res;
  }
}

async function getCsrf(client) {
  const res = await client.fetch(`${BASE_URL}/api/auth/csrf-token`);
  const data = await res.json();
  return data.csrfToken;
}

async function run() {
  console.log('=== Starting Test: OEP-F-019 & OEP-F-020 (Admin Module Suite) ===\n');
  const admin = new SessionClient();

  try {
    // 1. Admin login
    let csrf = await getCsrf(admin);
    const loginRes = await admin.fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      body: JSON.stringify({ email: 'admin@oep.com', password: 'Admin@123' }),
    });
    if (!loginRes.ok) throw new Error(`Admin login failed: ${loginRes.status}`);
    console.log('[1] Admin logged in successfully.');

    csrf = await getCsrf(admin);

    // 2. List Users
    const listRes = await admin.fetch(`${BASE_URL}/api/admin/users?role=Student`);
    const listData = await listRes.json();
    if (!listRes.ok) throw new Error(`List users failed: ${listRes.status}`);
    console.log(`[2] Listed students: found ${listData.users.length} users.`);

    // 3. Create a new user
    const tempEmail = `testuser_${Date.now()}@test.com`;
    const createRes = await admin.fetch(`${BASE_URL}/api/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      body: JSON.stringify({
        fullName: 'Automated Test User',
        email: tempEmail,
        password: 'Password@123',
        role: 'Student',
      }),
    });
    const createData = await createRes.json();
    if (!createRes.ok) throw new Error(`Create user failed: ${JSON.stringify(createData)}`);
    const newUserId = createData.userId;
    console.log(`[3] Admin created new user #${newUserId} (${tempEmail}).`);

    // 4. Update user (Deactivate)
    const deactRes = await admin.fetch(`${BASE_URL}/api/admin/users/${newUserId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      body: JSON.stringify({ isActive: false }),
    });
    if (!deactRes.ok) throw new Error(`Deactivate user failed: ${deactRes.status}`);
    console.log(`[4] User #${newUserId} deactivated successfully.`);

    // 5. Verify deactivated user cannot log in
    const testUserClient = new SessionClient();
    const testCsrf = await getCsrf(testUserClient);
    const deactLoginRes = await testUserClient.fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': testCsrf },
      body: JSON.stringify({ email: tempEmail, password: 'Password@123' }),
    });
    const deactLoginData = await deactLoginRes.json();
    if (deactLoginRes.status !== 403 || deactLoginData.error?.code !== 'ACCOUNT_DEACTIVATED') {
      throw new Error(`Expected 403 ACCOUNT_DEACTIVATED for deactivated user, got ${deactLoginRes.status}: ${JSON.stringify(deactLoginData)}`);
    }
    console.log('✓ TC-Admin-01 (Part 1): Deactivated user cannot log in.');

    // 6. Test Self-Deactivation Prevention
    // Admin user id is 1
    const selfDeactRes = await admin.fetch(`${BASE_URL}/api/admin/users/1`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      body: JSON.stringify({ isActive: false }),
    });
    const selfDeactData = await selfDeactRes.json();
    if (selfDeactRes.status !== 400 || selfDeactData.error?.code !== 'SELF_DEACTIVATE') {
      throw new Error(`Expected 400 SELF_DEACTIVATE, got ${selfDeactRes.status}: ${JSON.stringify(selfDeactData)}`);
    }
    console.log('✓ TC-Admin-01 (Part 2): Admin self-deactivation correctly rejected.');

    // 7. Test Self-Deletion Prevention
    const selfDelRes = await admin.fetch(`${BASE_URL}/api/admin/users/1`, {
      method: 'DELETE',
      headers: { 'X-CSRF-Token': csrf },
    });
    const selfDelData = await selfDelRes.json();
    if (selfDelRes.status !== 400 || selfDelData.error?.code !== 'SELF_DELETE') {
      throw new Error(`Expected 400 SELF_DELETE, got ${selfDelRes.status}: ${JSON.stringify(selfDelData)}`);
    }
    console.log('✓ TC-Admin-01 (Part 3): Admin self-deletion correctly rejected.');

    // 8. Delete the test user
    const deleteRes = await admin.fetch(`${BASE_URL}/api/admin/users/${newUserId}`, {
      method: 'DELETE',
      headers: { 'X-CSRF-Token': csrf },
    });
    if (!deleteRes.ok) throw new Error(`Delete user failed: ${deleteRes.status}`);
    console.log(`[5] User #${newUserId} deleted successfully.`);

    // 9. Verify Admin Dashboard (OEP-F-020)
    const dashRes = await admin.fetch(`${BASE_URL}/api/admin/dashboard`);
    const dashData = await dashRes.json();
    if (!dashRes.ok) throw new Error(`Get dashboard failed: ${dashRes.status}`);

    console.log('[6] Admin Dashboard Data:', {
      systemHealth: dashData.systemHealth,
      activeExamCount: dashData.activeExamCount,
      userCounts: dashData.userCounts,
      timestamp: dashData.timestamp,
    });

    if (dashData.systemHealth?.status !== 'ok' || typeof dashData.systemHealth?.uptime !== 'number') {
      throw new Error('System health indicators missing or degraded');
    }
    console.log('✓ TC-Admin-02 / OEP-F-020: Admin dashboard metrics verified.');

    console.log('\n>>> SUCCESS: TC-Admin-01 & TC-Admin-02 / OEP-F-019 & OEP-F-020 PASSED!\n');
    process.exit(0);
  } catch (err) {
    console.error('\n>>> TEST FAILED:', err.message);
    process.exit(1);
  }
}

run();
