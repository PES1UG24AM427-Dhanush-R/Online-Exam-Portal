/**
 * Ops Monitoring & Uptime Service (OEP-NF-002)
 *
 * Traceability:
 * - SRS OEP-NF-002: System shall maintain 99.5% uptime per month,
 *   excluding scheduled maintenance windows announced >= 24 hours in advance.
 * - Test: Ops monitoring reports / TC-Ops-01
 */

// In-memory fallback and buffer for uptime checks and maintenance windows
const inMemoryState = {
  startedAt: Date.now(),
  uptimeChecks: [],
  maintenanceWindows: [],
  simulatedOutages: [],
};

const SLA_TARGET_PERCENT = 99.5;
const MONTH_MINUTES = 43200; // 30 days * 24 hours * 60 minutes
const MAX_UNPLANNED_DOWNTIME_MINUTES = 216; // (100 - 99.5)% * 43200 = 216 minutes (3h 36m)

function getDbPool() {
  try {
    return require('../../config/db');
  } catch (err) {
    return null;
  }
}

/**
 * Pure calculation logic for Monthly Uptime Percentage (OEP-NF-002 SLA)
 *
 * @param {Object} params
 * @param {number} [params.totalMinutes=43200] Monitored timeframe in minutes (default 30 days)
 * @param {number} [params.unplannedDowntimeMinutes=0] Unplanned outage duration in minutes
 * @param {number} [params.scheduledMaintenanceMinutes=0] Scheduled maintenance duration in minutes
 * @param {number} [params.advanceNoticeHours=24] Hours in advance the maintenance was announced
 * @returns {Object} Calculated metrics including availability percentage and SLA status
 */
function calculateMonthlyUptime({
  totalMinutes = MONTH_MINUTES,
  unplannedDowntimeMinutes = 0,
  scheduledMaintenanceMinutes = 0,
  advanceNoticeHours = 24,
} = {}) {
  // OEP-NF-002 Rule: Scheduled maintenance is excluded ONLY IF announced >= 24h in advance.
  const qualifiesForExclusion = advanceNoticeHours >= 24;

  const validScheduledMaintenance = qualifiesForExclusion ? scheduledMaintenanceMinutes : 0;
  // If maintenance was announced < 24h in advance, it is penalized as unplanned downtime
  const penalizedDowntime = qualifiesForExclusion
    ? unplannedDowntimeMinutes
    : unplannedDowntimeMinutes + scheduledMaintenanceMinutes;

  // Effective operational time = total monitored time - valid scheduled maintenance
  const effectiveOperationalMinutes = Math.max(1, totalMinutes - validScheduledMaintenance);

  const uptimeMinutes = Math.max(0, effectiveOperationalMinutes - penalizedDowntime);
  const uptimePercentage = Number(
    ((uptimeMinutes / effectiveOperationalMinutes) * 100).toFixed(2)
  );

  const isSlaMet = uptimePercentage >= SLA_TARGET_PERCENT;

  return {
    totalMinutes,
    scheduledMaintenanceMinutes,
    advanceNoticeHours,
    qualifiesForExclusion,
    effectiveOperationalMinutes,
    unplannedDowntimeMinutes: penalizedDowntime,
    uptimeMinutes,
    uptimePercentage: Math.min(100, Math.max(0, uptimePercentage)),
    slaTargetPercent: SLA_TARGET_PERCENT,
    maxAllowedUnplannedDowntimeMinutes: MAX_UNPLANNED_DOWNTIME_MINUTES,
    isSlaMet,
  };
}

/**
 * Record a heartbeat/uptime check.
 */
async function recordCheck({ status = 'up', responseTimeMs = 0, errorMessage = null, maintenanceWindowId = null }) {
  const check = {
    timestamp: new Date(),
    status,
    responseTimeMs,
    errorMessage,
    maintenanceWindowId,
  };

  inMemoryState.uptimeChecks.push(check);
  if (inMemoryState.uptimeChecks.length > 500) {
    inMemoryState.uptimeChecks.shift();
  }

  const pool = getDbPool();
  if (pool && typeof pool.query === 'function') {
    try {
      await pool.query(
        `INSERT INTO uptime_logs (status, response_time_ms, error_message, maintenance_window_id)
         VALUES (?, ?, ?, ?)`,
        [status, responseTimeMs, errorMessage, maintenanceWindowId]
      );
    } catch (err) {
      // Graceful fallback to in-memory state
    }
  }

  return check;
}

/**
 * Schedule a maintenance window enforcing the OEP-NF-002 24-hour advance notice requirement.
 */
async function scheduleMaintenanceWindow({ title, description, startTime, endTime, announcedAt, createdBy }) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const announced = new Date(announcedAt || new Date());

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error('Invalid start or end date format.');
  }

  if (end <= start) {
    throw new Error('Maintenance end time must be after start time.');
  }

  const advanceNoticeHours = (start.getTime() - announced.getTime()) / (1000 * 60 * 60);
  const qualifiesForExclusion = advanceNoticeHours >= 24;

  const windowData = {
    id: inMemoryState.maintenanceWindows.length + 1,
    title,
    description: description || '',
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    announcedAt: announced.toISOString(),
    advanceNoticeHours: Number(advanceNoticeHours.toFixed(2)),
    qualifiesForExclusion,
    status: 'scheduled',
    createdBy: createdBy || 1,
    createdAt: new Date().toISOString(),
  };

  const pool = getDbPool();
  if (pool && typeof pool.query === 'function') {
    try {
      const [res] = await pool.query(
        `INSERT INTO maintenance_windows (title, description, start_time, end_time, announced_at, status, created_by)
         VALUES (?, ?, ?, ?, ?, 'scheduled', ?)`,
        [title, description || '', start, end, announced, createdBy || 1]
      );
      windowData.id = res.insertId;
    } catch (err) {
      // Fallback to in-memory state
    }
  }

  inMemoryState.maintenanceWindows.push(windowData);
  return windowData;
}

/**
 * Retrieve current uptime metrics and monthly SLA summary.
 */
async function getUptimeSummary() {
  const processUptimeSeconds = process.uptime();
  let dbHealthy = false;
  let activeExams = 0;

  const pool = getDbPool();
  if (pool && typeof pool.query === 'function') {
    try {
      const [rows] = await pool.query(`SELECT COUNT(*) AS active_exams FROM attempts WHERE status = 'in_progress'`);
      activeExams = rows[0]?.active_exams || 0;
      dbHealthy = true;
    } catch (err) {
      dbHealthy = false;
    }
  }

  // Calculate overall metrics
  const simulatedMinutesDowntime = inMemoryState.simulatedOutages.reduce((acc, o) => acc + o.durationMinutes, 0);
  const metrics = calculateMonthlyUptime({
    totalMinutes: MONTH_MINUTES,
    unplannedDowntimeMinutes: simulatedMinutesDowntime,
    scheduledMaintenanceMinutes: 0,
    advanceNoticeHours: 24,
  });

  return {
    status: dbHealthy ? 'ok' : 'degraded',
    processUptimeSeconds,
    monthlyUptimePercentage: metrics.uptimePercentage,
    targetSla: metrics.slaTargetPercent,
    isSlaMet: metrics.isSlaMet,
    maxAllowedUnplannedDowntimeMinutes: metrics.maxAllowedUnplannedDowntimeMinutes,
    activeExamSessions: activeExams,
    totalMonitoredDays: 30,
    maintenanceWindowsCount: inMemoryState.maintenanceWindows.length,
    timestamp: new Date().toISOString(),
  };
}

/**
 * List maintenance windows.
 */
async function listMaintenanceWindows() {
  const pool = getDbPool();
  if (pool && typeof pool.query === 'function') {
    try {
      const [rows] = await pool.query(
        `SELECT id, title, description, start_time AS startTime, end_time AS endTime,
                announced_at AS announcedAt, status, created_by AS createdBy, created_at AS createdAt
         FROM maintenance_windows ORDER BY start_time DESC`
      );
      if (rows && rows.length > 0) {
        return rows.map(r => {
          const diffHours = (new Date(r.startTime) - new Date(r.announcedAt)) / (1000 * 60 * 60);
          return {
            ...r,
            advanceNoticeHours: Number(diffHours.toFixed(2)),
            qualifiesForExclusion: diffHours >= 24,
          };
        });
      }
    } catch (err) {
      // Fallback to in-memory state
    }
  }

  return inMemoryState.maintenanceWindows;
}

module.exports = {
  SLA_TARGET_PERCENT,
  MONTH_MINUTES,
  MAX_UNPLANNED_DOWNTIME_MINUTES,
  calculateMonthlyUptime,
  recordCheck,
  scheduleMaintenanceWindow,
  getUptimeSummary,
  listMaintenanceWindows,
  inMemoryState,
};
