
/**
 * Admin Module Automated Test Suite
 *
 * OEP-F-019: Admin user management
 * OEP-F-020: Admin dashboard and system health
 * OEP-NF-002: Uptime monitoring and maintenance scheduling
 */

require('dotenv').config();

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const pool = require('../backend/config/db');

const BASE_URL = process.env.APP_URL || 'http://localhost:3000';
const UNIQUE = crypto.randomUUID().replace(/-/g, '');

const ADMIN_EMAIL = `admin-test-${UNIQUE}@example.com`;
const TEACHER_EMAIL = `admin-teacher-${UNIQUE}@example.com`;
const STUDENT_EMAIL = `admin-student-${UNIQUE}@example.com`;

const PASSWORD = 'AdminTest@123';

class SessionClient {
  constructor() {
    this.cookies = new Map();
  }

  updateCookies(response) {
    let cookies = [];

    if (typeof response.headers.getSetCookie === 'function') {
      cookies = response.headers.getSetCookie();
    } else {
      const cookie = response.headers.get('set-cookie');
      if (cookie) cookies = [cookie];
    }

    for (const item of cookies) {
      const parts = item.split(';')[0].split('=');

      if (parts.length >= 2) {
        this.cookies.set(
          parts[0].trim(),
          parts.slice(1).join('=').trim()
        );
      }
    }
  }

  cookieHeader() {
    return Array.from(this.cookies.entries())
      .map(([key, value]) => `${key}=${value}`)
      .join('; ');
  }

  async fetch(url, options = {}) {
    const headers = { ...(options.headers || {}) };
    const cookie = this.cookieHeader();

    if (cookie) headers.Cookie = cookie;

    const response = await fetch(url, {
      ...options,
      headers
    });

    this.updateCookies(response);
    return response;
  }
}

async function readJson(response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      `Expected JSON response. Received: ${text.slice(0, 300)}`
    );
  }
}

async function getCsrfToken(client) {
  const response = await client.fetch(
    `${BASE_URL}/api/auth/csrf-token`
  );

  const data = await readJson(response);

  if (!response.ok || !data.csrfToken) {
    throw new Error('Could not obtain CSRF token.');
  }

  return data.csrfToken;
}

async function apiRequest(client, method, endpoint, body) {
  const headers = {
    'Content-Type': 'application/json'
  };

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    headers['X-CSRF-Token'] = await getCsrfToken(client);
  }

  return client.fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    ...(body !== undefined
      ? { body: JSON.stringify(body) }
      : {})
  });
}

async function expectStatus(response, expected, description) {
  const data = await readJson(response);

  if (response.status !== expected) {
    throw new Error(
      `${description}: expected HTTP ${expected}, received ${response.status}. ${JSON.stringify(data)}`
    );
  }

  return data;
}

async function createUser(email, role, name) {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  const [result] = await pool.query(
    `INSERT INTO users
     (full_name, email, password_hash, role)
     VALUES (?, ?, ?, ?)`,
    [name, email, passwordHash, role]
  );

  return result.insertId;
}

async function login(client, email, role) {
  const response = await apiRequest(
    client,
    'POST',
    '/api/auth/login',
    {
      email,
      password: PASSWORD
    }
  );

  const data = await expectStatus(
    response,
    200,
    `${role} login`
  );

  if (data.role !== role) {
    throw new Error(`Expected ${role} role after login.`);
  }
}

async function run() {
  const adminClient = new SessionClient();
  const teacherClient = new SessionClient();
  const studentClient = new SessionClient();

  let adminId = null;
  let teacherId = null;
  let studentId = null;
  let createdUserId = null;
  let maintenanceIds = [];

  let passed = 0;

  function pass(message) {
    passed++;
    console.log(`  PASS: ${message}`);
  }

  console.log('================================================');
  console.log(' ADMIN MODULE TESTS');
  console.log(' OEP-F-019, OEP-F-020, OEP-NF-002');
  console.log('================================================');

  try {
    // ------------------------------------------------
    // SETUP: Temporary Admin, Teacher and Student
    // ------------------------------------------------

    adminId = await createUser(
      ADMIN_EMAIL,
      'Admin',
      'Temporary Admin Test'
    );

    teacherId = await createUser(
      TEACHER_EMAIL,
      'Teacher',
      'Temporary Teacher Test'
    );

    studentId = await createUser(
      STUDENT_EMAIL,
      'Student',
      'Temporary Student Test'
    );

    await login(adminClient, ADMIN_EMAIL, 'Admin');
    await login(teacherClient, TEACHER_EMAIL, 'Teacher');
    await login(studentClient, STUDENT_EMAIL, 'Student');

    pass('Temporary Admin, Teacher and Student accounts authenticated.');

    // ------------------------------------------------
    // SECURITY: Non-Admin access restrictions
    // ------------------------------------------------

    console.log('\n[TEST] Admin role restrictions');

    for (const endpoint of [
      '/api/admin/users',
      '/api/admin/dashboard',
      '/api/admin/uptime',
      '/api/admin/maintenance'
    ]) {
      const response = await teacherClient.fetch(
        `${BASE_URL}${endpoint}`
      );

      if (![401, 403].includes(response.status)) {
        const data = await readJson(response);
        throw new Error(
          `Teacher accessed ${endpoint}: HTTP ${response.status} ${JSON.stringify(data)}`
        );
      }

      pass(`Teacher denied access to ${endpoint}.`);
    }

    const studentAdminResponse = await studentClient.fetch(
      `${BASE_URL}/api/admin/users`
    );

    if (![401, 403].includes(studentAdminResponse.status)) {
      throw new Error('Student was able to access Admin user listing.');
    }

    pass('Student denied access to Admin endpoints.');

    // ------------------------------------------------
    // OEP-F-019: List users
    // ------------------------------------------------

    console.log('\n[TEST F-019] User management');

    const listResponse = await adminClient.fetch(
      `${BASE_URL}/api/admin/users`
    );

    const listData = await expectStatus(
      listResponse,
      200,
      'List users'
    );

    if (!Array.isArray(listData.users)) {
      throw new Error('User listing did not return a users array.');
    }

    if (!listData.users.some(user => Number(user.id) === Number(adminId))) {
      throw new Error('Temporary Admin not present in user listing.');
    }

    pass('Admin can list users.');

    // ------------------------------------------------
    // Filter users by role
    // ------------------------------------------------

    const roleResponse = await adminClient.fetch(
      `${BASE_URL}/api/admin/users?role=Teacher`
    );

    const roleData = await expectStatus(
      roleResponse,
      200,
      'Filter users by role'
    );

    if (
      !roleData.users.some(
        user => Number(user.id) === Number(teacherId)
      )
    ) {
      throw new Error('Teacher role filter did not return expected user.');
    }

    if (roleData.users.some(user => user.role !== 'Teacher')) {
      throw new Error('Role filter returned users with other roles.');
    }

    pass('User listing can filter by role.');

    // ------------------------------------------------
    // Filter users by active status
    // ------------------------------------------------

    const activeResponse = await adminClient.fetch(
      `${BASE_URL}/api/admin/users?is_active=1`
    );

    const activeData = await expectStatus(
      activeResponse,
      200,
      'Filter active users'
    );

    if (activeData.users.some(user => Number(user.is_active) !== 1)) {
      throw new Error('Active user filter returned inactive users.');
    }

    pass('User listing can filter active accounts.');

    // ------------------------------------------------
    // Search users
    // ------------------------------------------------

    const searchResponse = await adminClient.fetch(
      `${BASE_URL}/api/admin/users?search=${encodeURIComponent(ADMIN_EMAIL)}`
    );

    const searchData = await expectStatus(
      searchResponse,
      200,
      'Search users'
    );

    if (
      !searchData.users.some(
        user => user.email === ADMIN_EMAIL
      )
    ) {
      throw new Error('User search did not find the temporary Admin.');
    }

    pass('User listing supports email search.');

    // ------------------------------------------------
    // Create user
    // ------------------------------------------------

    const createPayload = {
      fullName: `Created User ${UNIQUE}`,
      email: `created-user-${UNIQUE}@example.com`,
      password: 'CreatedUser@123',
      role: 'Student'
    };

    const createResponse = await apiRequest(
      adminClient,
      'POST',
      '/api/admin/users',
      createPayload
    );

    const createData = await expectStatus(
      createResponse,
      201,
      'Create user'
    );

    createdUserId = createData.userId;

    if (!createdUserId) {
      throw new Error('Create user did not return a userId.');
    }

    const [createdRows] = await pool.query(
      `SELECT id, full_name, email, role, password_hash
       FROM users WHERE id = ?`,
      [createdUserId]
    );

    if (
      createdRows.length !== 1 ||
      createdRows[0].email !== createPayload.email ||
      createdRows[0].role !== 'Student'
    ) {
      throw new Error('Created user details were not saved correctly.');
    }

    if (
      createdRows[0].password_hash === createPayload.password ||
      !(await bcrypt.compare(
        createPayload.password,
        createdRows[0].password_hash
      ))
    ) {
      throw new Error('Created user password was not securely hashed.');
    }

    pass('Admin can create a user with a securely hashed password.');

    // ------------------------------------------------
    // Duplicate email validation
    // ------------------------------------------------

    const duplicateResponse = await apiRequest(
      adminClient,
      'POST',
      '/api/admin/users',
      createPayload
    );

    const duplicateData = await expectStatus(
      duplicateResponse,
      409,
      'Duplicate email'
    );

    if (duplicateData.error?.code !== 'EMAIL_TAKEN') {
      throw new Error('Duplicate email returned an unexpected error.');
    }

    pass('Duplicate email registration is rejected.');

    // ------------------------------------------------
    // Input validation
    // ------------------------------------------------

    const invalidPayloads = [
      {
        fullName: '',
        email: `invalid-${UNIQUE}@example.com`,
        password: 'ValidPass@123',
        role: 'Student'
      },
      {
        fullName: 'Invalid Email',
        email: 'not-an-email',
        password: 'ValidPass@123',
        role: 'Student'
      },
      {
        fullName: 'Weak Password',
        email: `weak-${UNIQUE}@example.com`,
        password: '123',
        role: 'Student'
      },
      {
        fullName: 'Invalid Role',
        email: `role-${UNIQUE}@example.com`,
        password: 'ValidPass@123',
        role: 'SuperUser'
      }
    ];

    for (const payload of invalidPayloads) {
      const response = await apiRequest(
        adminClient,
        'POST',
        '/api/admin/users',
        payload
      );

      await expectStatus(
        response,
        400,
        'Invalid user input'
      );
    }

    pass('Empty full name is rejected.');
    pass('Invalid email is rejected.');
    pass('Password shorter than 8 characters is rejected.');
    pass('Invalid user role is rejected.');

    // ------------------------------------------------
    // Update user role
    // ------------------------------------------------

    const updateRoleResponse = await apiRequest(
      adminClient,
      'PATCH',
      `/api/admin/users/${createdUserId}`,
      {
        role: 'Teacher'
      }
    );

    await expectStatus(
      updateRoleResponse,
      200,
      'Update user role'
    );

    const [roleRows] = await pool.query(
      'SELECT role FROM users WHERE id = ?',
      [createdUserId]
    );

    if (roleRows[0].role !== 'Teacher') {
      throw new Error('User role was not updated.');
    }

    pass('Admin can update a user role.');

    // ------------------------------------------------
    // Deactivate and reactivate user
    // ------------------------------------------------

    const deactivateResponse = await apiRequest(
      adminClient,
      'PATCH',
      `/api/admin/users/${createdUserId}`,
      {
        isActive: false
      }
    );

    await expectStatus(
      deactivateResponse,
      200,
      'Deactivate user'
    );

    const [inactiveRows] = await pool.query(
      'SELECT is_active FROM users WHERE id = ?',
      [createdUserId]
    );

    if (Number(inactiveRows[0].is_active) !== 0) {
      throw new Error('User was not deactivated.');
    }

    pass('Admin can deactivate a user.');

    const reactivateResponse = await apiRequest(
      adminClient,
      'PATCH',
      `/api/admin/users/${createdUserId}`,
      {
        isActive: true
      }
    );

    await expectStatus(
      reactivateResponse,
      200,
      'Reactivate user'
    );

    const [activeRows] = await pool.query(
      'SELECT is_active FROM users WHERE id = ?',
      [createdUserId]
    );

    if (Number(activeRows[0].is_active) !== 1) {
      throw new Error('User was not reactivated.');
    }

    pass('Admin can reactivate a user.');

    // ------------------------------------------------
    // Reject empty updates
    // ------------------------------------------------

    const emptyUpdateResponse = await apiRequest(
      adminClient,
      'PATCH',
      `/api/admin/users/${createdUserId}`,
      {}
    );

    const emptyUpdateData = await expectStatus(
      emptyUpdateResponse,
      400,
      'Empty user update'
    );

    if (emptyUpdateData.error?.code !== 'NO_CHANGES') {
      throw new Error('Empty update returned an unexpected error.');
    }

    pass('Empty user update is rejected.');

    // ------------------------------------------------
    // Reject updates for missing users
    // ------------------------------------------------

    const missingUpdateResponse = await apiRequest(
      adminClient,
      'PATCH',
      '/api/admin/users/999999999',
      {
        role: 'Student'
      }
    );

    const missingUpdateData = await expectStatus(
      missingUpdateResponse,
      404,
      'Update missing user'
    );

    if (missingUpdateData.error?.code !== 'NOT_FOUND') {
      throw new Error('Missing user update returned an unexpected error.');
    }

    pass('Updating a nonexistent user returns 404.');

    // ------------------------------------------------
    // Prevent Admin self-deactivation
    // ------------------------------------------------

    const selfDeactivateResponse = await apiRequest(
      adminClient,
      'PATCH',
      `/api/admin/users/${adminId}`,
      {
        isActive: false
      }
    );

    const selfDeactivateData = await expectStatus(
      selfDeactivateResponse,
      400,
      'Admin self-deactivation'
    );

    if (selfDeactivateData.error?.code !== 'SELF_DEACTIVATE') {
      throw new Error('Self-deactivation returned an unexpected error.');
    }

    pass('Admin cannot deactivate their own account.');

    // ------------------------------------------------
    // Prevent Admin self-deletion
    // ------------------------------------------------

    const selfDeleteResponse = await apiRequest(
      adminClient,
      'DELETE',
      `/api/admin/users/${adminId}`
    );

    const selfDeleteData = await expectStatus(
      selfDeleteResponse,
      400,
      'Admin self-deletion'
    );

    if (selfDeleteData.error?.code !== 'SELF_DELETE') {
      throw new Error('Self-deletion returned an unexpected error.');
    }

    pass('Admin cannot delete their own account.');

    // ------------------------------------------------
    // Delete user
    // ------------------------------------------------

    const deleteResponse = await apiRequest(
      adminClient,
      'DELETE',
      `/api/admin/users/${createdUserId}`
    );

    await expectStatus(
      deleteResponse,
      200,
      'Delete user'
    );

    const [deletedRows] = await pool.query(
      'SELECT id FROM users WHERE id = ?',
      [createdUserId]
    );

    if (deletedRows.length !== 0) {
      throw new Error('User was not deleted.');
    }

    createdUserId = null;

    pass('Admin can delete a user.');

    // ------------------------------------------------
    // Reject deletion of nonexistent user
    // ------------------------------------------------

    const missingDeleteResponse = await apiRequest(
      adminClient,
      'DELETE',
      '/api/admin/users/999999999'
    );

    const missingDeleteData = await expectStatus(
      missingDeleteResponse,
      404,
      'Delete missing user'
    );

    if (missingDeleteData.error?.code !== 'NOT_FOUND') {
      throw new Error('Missing user deletion returned unexpected error.');
    }

    pass('Deleting a nonexistent user returns 404.');

    // ------------------------------------------------
    // OEP-F-020: Dashboard
    // ------------------------------------------------

    console.log('\n[TEST F-020] Admin dashboard');

    const dashboardResponse = await adminClient.fetch(
      `${BASE_URL}/api/admin/dashboard`
    );

    const dashboardData = await expectStatus(
      dashboardResponse,
      200,
      'Admin dashboard'
    );

    if (!dashboardData.systemHealth) {
      throw new Error('Dashboard did not return system health.');
    }

    if (dashboardData.systemHealth.status !== 'ok') {
      throw new Error(
        `Expected healthy database status, received ${dashboardData.systemHealth.status}.`
      );
    }

    pass('Dashboard returns system health information.');

    if (typeof dashboardData.systemHealth.uptime !== 'number') {
      throw new Error('Dashboard process uptime is missing or invalid.');
    }

    pass('Dashboard returns process uptime.');

    if (
      typeof dashboardData.systemHealth.uptimePercentage !== 'number' ||
      typeof dashboardData.systemHealth.isSlaMet !== 'boolean'
    ) {
      throw new Error('Dashboard uptime SLA information is invalid.');
    }

    pass('Dashboard returns monthly uptime and SLA status.');

    if (!dashboardData.userCounts) {
      throw new Error('Dashboard user counts are missing.');
    }

    for (const role of ['students', 'teachers', 'admins', 'deactivated']) {
      if (dashboardData.userCounts[role] === undefined ||
          dashboardData.userCounts[role] === null) {
        throw new Error(`Dashboard is missing ${role} count.`);
      }
    }

    pass('Dashboard returns Student, Teacher, Admin and deactivated counts.');

    if (
      typeof dashboardData.activeExamCount !== 'number' &&
      typeof dashboardData.activeExamCount !== 'string'
    ) {
      throw new Error('Dashboard active exam count is missing.');
    }

    if (!Array.isArray(dashboardData.activeExams)) {
      throw new Error('Dashboard active exam details are missing.');
    }

    pass('Dashboard returns active exam counts and details.');

    if (!dashboardData.timestamp ||
        Number.isNaN(Date.parse(dashboardData.timestamp))) {
      throw new Error('Dashboard timestamp is invalid.');
    }

    pass('Dashboard returns a valid timestamp.');

    // ------------------------------------------------
    // OEP-NF-002: Uptime statistics
    // ------------------------------------------------

    console.log('\n[TEST NF-002] Uptime and maintenance');

    const uptimeResponse = await adminClient.fetch(
      `${BASE_URL}/api/admin/uptime`
    );

    const uptimeData = await expectStatus(
      uptimeResponse,
      200,
      'Uptime statistics'
    );

    if (uptimeData.targetSla !== 99.5) {
      throw new Error(`Expected SLA target 99.5, received ${uptimeData.targetSla}.`);
    }

    pass('Uptime endpoint returns the 99.5% SLA target.');

    if (uptimeData.isSlaMet !== true) {
      throw new Error('Expected SLA to be met in the initial uptime state.');
    }

    pass('Uptime endpoint reports current SLA status.');

    if (
      uptimeData.slaSpecification?.requirementId !== 'OEP-NF-002' ||
      uptimeData.slaSpecification?.targetMonthlyAvailability !== '99.5%'
    ) {
      throw new Error('Uptime SLA specification is incomplete.');
    }

    pass('Uptime endpoint returns OEP-NF-002 SLA specification.');

    if (!Array.isArray(uptimeData.maintenanceWindows)) {
      throw new Error('Uptime endpoint did not return maintenance windows.');
    }

    pass('Uptime endpoint returns maintenance window information.');

    // ------------------------------------------------
    // Maintenance: create qualifying window
    // ------------------------------------------------

    const futureStart = new Date(Date.now() + 72 * 60 * 60 * 1000);
    const futureEnd = new Date(Date.now() + 73 * 60 * 60 * 1000);
    const announcedAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const maintenancePayload = {
      title: `Admin Test Maintenance ${UNIQUE}`,
      description: 'Automated test maintenance window.',
      startTime: futureStart.toISOString(),
      endTime: futureEnd.toISOString(),
      announcedAt: announcedAt.toISOString()
    };

    const maintenanceResponse = await apiRequest(
      adminClient,
      'POST',
      '/api/admin/maintenance',
      maintenancePayload
    );

    const maintenanceData = await expectStatus(
      maintenanceResponse,
      201,
      'Create maintenance window'
    );

    const maintenanceWindow = maintenanceData.maintenanceWindow;

    if (!maintenanceWindow || !maintenanceWindow.id) {
      throw new Error('Maintenance creation did not return a window ID.');
    }

    maintenanceIds.push(maintenanceWindow.id);

    if (maintenanceWindow.qualifiesForExclusion !== true) {
      throw new Error('Maintenance announced 48 hours ahead should qualify for exclusion.');
    }

    pass('Maintenance window announced at least 24 hours ahead qualifies for SLA exclusion.');

    // ------------------------------------------------
    // Maintenance: create non-qualifying window
    // ------------------------------------------------

    const shortNoticeStart = new Date(Date.now() + 10 * 60 * 60 * 1000);
    const shortNoticeEnd = new Date(Date.now() + 11 * 60 * 60 * 1000);
    const shortNoticeAnnouncement = new Date();

    const shortNoticeResponse = await apiRequest(
      adminClient,
      'POST',
      '/api/admin/maintenance',
      {
        title: `Short Notice Maintenance ${UNIQUE}`,
        description: 'Short notice test.',
        startTime: shortNoticeStart.toISOString(),
        endTime: shortNoticeEnd.toISOString(),
        announcedAt: shortNoticeAnnouncement.toISOString()
      }
    );

    const shortNoticeData = await expectStatus(
      shortNoticeResponse,
      201,
      'Create short notice maintenance'
    );

    const shortNoticeWindow = shortNoticeData.maintenanceWindow;

    if (!shortNoticeWindow || !shortNoticeWindow.id) {
      throw new Error('Short notice maintenance did not return a window ID.');
    }

    maintenanceIds.push(shortNoticeWindow.id);

    if (shortNoticeWindow.qualifiesForExclusion !== false) {
      throw new Error('Maintenance announced less than 24 hours ahead must not qualify.');
    }

    pass('Maintenance announced less than 24 hours ahead does not qualify for SLA exclusion.');

    // ------------------------------------------------
    // Maintenance validation: missing fields
    // ------------------------------------------------

    const missingFieldsResponse = await apiRequest(
      adminClient,
      'POST',
      '/api/admin/maintenance',
      {
        title: 'Missing dates test'
      }
    );

    const missingFieldsData = await expectStatus(
      missingFieldsResponse,
      400,
      'Maintenance missing fields'
    );

    if (missingFieldsData.error?.code !== 'INVALID_INPUT') {
      throw new Error('Missing maintenance fields returned unexpected error.');
    }

    pass('Maintenance creation rejects missing required fields.');

    // ------------------------------------------------
    // Maintenance validation: invalid dates
    // ------------------------------------------------

    const invalidDateResponse = await apiRequest(
      adminClient,
      'POST',
      '/api/admin/maintenance',
      {
        title: 'Invalid date test',
        startTime: 'not-a-date',
        endTime: 'also-not-a-date'
      }
    );

    await expectStatus(
      invalidDateResponse,
      400,
      'Invalid maintenance dates'
    );

    pass('Maintenance creation rejects invalid date formats.');

    // ------------------------------------------------
    // Maintenance validation: end before start
    // ------------------------------------------------

    const invalidRangeResponse = await apiRequest(
      adminClient,
      'POST',
      '/api/admin/maintenance',
      {
        title: 'Invalid range test',
        startTime: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
        endTime: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
        announcedAt: new Date().toISOString()
      }
    );

    await expectStatus(
      invalidRangeResponse,
      400,
      'Invalid maintenance time range'
    );

    pass('Maintenance end time must be after start time.');

    // ------------------------------------------------
    // List maintenance windows
    // ------------------------------------------------

    const maintenanceListResponse = await adminClient.fetch(
      `${BASE_URL}/api/admin/maintenance`
    );

    const maintenanceListData = await expectStatus(
      maintenanceListResponse,
      200,
      'List maintenance windows'
    );

    if (!Array.isArray(maintenanceListData.maintenanceWindows)) {
      throw new Error('Maintenance listing did not return an array.');
    }

    for (const id of maintenanceIds) {
      if (
        !maintenanceListData.maintenanceWindows.some(
          window => Number(window.id) === Number(id)
        )
      ) {
        throw new Error(`Maintenance window ${id} was not found in listing.`);
      }
    }

    pass('Admin can retrieve scheduled maintenance windows.');

    // ------------------------------------------------
    // Verify maintenance records in database
    // ------------------------------------------------

    const [maintenanceRows] = await pool.query(
      `SELECT id, created_by, status
       FROM maintenance_windows
       WHERE id IN (?, ?)`,
      maintenanceIds
    );

    if (maintenanceRows.length !== 2) {
      throw new Error('Expected both maintenance records in database.');
    }

    if (
      maintenanceRows.some(
        row => Number(row.created_by) !== Number(adminId)
      )
    ) {
      throw new Error('Maintenance creator was not recorded correctly.');
    }

    pass('Maintenance records persist with correct Admin ownership.');

    // ------------------------------------------------
    // Security: non-Admin cannot create maintenance
    // ------------------------------------------------

    const forbiddenMaintenance = await apiRequest(
      teacherClient,
      'POST',
      '/api/admin/maintenance',
      maintenancePayload
    );

    if (![401, 403].includes(forbiddenMaintenance.status)) {
      const data = await readJson(forbiddenMaintenance);
      throw new Error(
        `Teacher created maintenance: HTTP ${forbiddenMaintenance.status} ${JSON.stringify(data)}`
      );
    }

    pass('Teacher cannot create maintenance windows.');

    // ------------------------------------------------
    // Summary
    // ------------------------------------------------

    console.log('\n================================================');
    console.log(' ADMIN MODULE TESTS COMPLETED');
    console.log(` PASSED: ${passed}`);
    console.log(' FAILED: 0');
    console.log(' OEP-F-019, OEP-F-020, OEP-NF-002');
    console.log('================================================');

  } catch (error) {
    console.error('\n>>> TEST FAILED:', error.message);
    process.exitCode = 1;

  } finally {
    console.log('\nCleaning up temporary Admin test data...');

    try {
      if (maintenanceIds.length > 0) {
        const placeholders = maintenanceIds.map(() => '?').join(',');

        await pool.query(
          `DELETE FROM maintenance_windows WHERE id IN (${placeholders})`,
          maintenanceIds
        );
      }

      for (const userId of [studentId, teacherId, createdUserId, adminId]) {
        if (userId) {
          await pool.query(
            'DELETE FROM audit_logs WHERE user_id = ?',
            [userId]
          );

          await pool.query(
            'DELETE FROM password_reset_tokens WHERE user_id = ?',
            [userId]
          );

          await pool.query(
            'DELETE FROM users WHERE id = ?',
            [userId]
          );
        }
      }

      console.log('Temporary Admin test data cleanup completed.');

    } catch (cleanupError) {
      console.error('Cleanup failed:', cleanupError.message);
      process.exitCode = 1;
    }

    await pool.end();
  }
}

run();
