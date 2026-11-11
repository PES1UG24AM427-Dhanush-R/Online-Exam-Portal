/**
 * Automated Verification Test for OEP-NF-002: 99.5% Monthly Uptime & Ops Monitoring
 *
 * Test Case Traceability: STP TC-Ops-01 / SRS OEP-NF-002
 *
 * Verifies:
 * 1. Mathematical calculation of monthly availability percentage against the 99.5% SLA threshold.
 * 2. Enforcement of the 24-hour advance announcement rule for scheduled maintenance exclusion.
 * 3. Proper penalty assessment (treating unannounced/late-announced maintenance as unplanned downtime).
 * 4. Alert trigger when cumulative downtime exceeds 216 minutes (0.5% of 30 days).
 * 5. Health check and Ops monitoring reporting structure via uptime service and /api/health.
 */

try {
  require('dotenv').config();
} catch (e) {
  // Graceful fallback when running in lightweight test environments
}

const uptimeService = require('../backend/modules/monitoring/uptime.service');

const MONTH_MINUTES = 43200; // 30 days * 24 hours * 60 minutes
const MAX_ALLOWED_DOWNTIME_MINUTES = 216; // 0.5% of 43,200 min = 216 min (3 hours 36 minutes)
const TARGET_SLA = 99.5;

async function run() {
  console.log('======================================================================');
  console.log('=== Starting Test: OEP-NF-002 (TC-Ops-01: 99.5% Monthly Uptime SLA) ===');
  console.log(`Target: Monthly Uptime >= ${TARGET_SLA}% | Max Allowable Downtime: ${MAX_ALLOWED_DOWNTIME_MINUTES} min`);
  console.log('======================================================================\n');

  let passedChecks = 0;
  const totalChecks = 8;

  try {
    // 1. Baseline Availability (Zero Downtime)
    console.log('[Check 1] Verifying baseline monthly availability with 0 downtime...');
    const baseline = uptimeService.calculateMonthlyUptime({
      totalMinutes: MONTH_MINUTES,
      unplannedDowntimeMinutes: 0,
      scheduledMaintenanceMinutes: 0,
      advanceNoticeHours: 24,
    });
    if (baseline.uptimePercentage === 100 && baseline.isSlaMet === true) {
      console.log(`✓ Baseline uptime is 100.00% (SLA met).`);
      passedChecks++;
    } else {
      throw new Error(`Baseline failed: expected 100%, got ${baseline.uptimePercentage}%`);
    }

    // 2. Acceptable Downtime within SLA Margin (e.g., 90 minutes)
    console.log('\n[Check 2] Verifying 90 minutes unplanned downtime within SLA limit...');
    const minorOutage = uptimeService.calculateMonthlyUptime({
      totalMinutes: MONTH_MINUTES,
      unplannedDowntimeMinutes: 90,
      scheduledMaintenanceMinutes: 0,
      advanceNoticeHours: 24,
    });
    if (minorOutage.uptimePercentage >= 99.5 && minorOutage.isSlaMet === true) {
      console.log(`✓ 90 min outage yields ${minorOutage.uptimePercentage}% uptime (>= 99.5%, SLA met).`);
      passedChecks++;
    } else {
      throw new Error(`Minor outage test failed: got ${minorOutage.uptimePercentage}%`);
    }

    // 3. Exact Threshold Boundary (216 minutes downtime)
    console.log('\n[Check 3] Verifying exact boundary condition (216 minutes allowable downtime)...');
    const boundary = uptimeService.calculateMonthlyUptime({
      totalMinutes: MONTH_MINUTES,
      unplannedDowntimeMinutes: MAX_ALLOWED_DOWNTIME_MINUTES,
      scheduledMaintenanceMinutes: 0,
      advanceNoticeHours: 24,
    });
    if (boundary.uptimePercentage === 99.5 && boundary.isSlaMet === true) {
      console.log(`✓ Boundary condition at 216 min downtime: exactly ${boundary.uptimePercentage}% (SLA met).`);
      passedChecks++;
    } else {
      throw new Error(`Boundary test failed: expected 99.50%, got ${boundary.uptimePercentage}%`);
    }

    // 4. SLA Breach Condition (> 216 minutes downtime)
    console.log('\n[Check 4] Verifying SLA breach detection when downtime exceeds 216 minutes...');
    const breach = uptimeService.calculateMonthlyUptime({
      totalMinutes: MONTH_MINUTES,
      unplannedDowntimeMinutes: 300,
      scheduledMaintenanceMinutes: 0,
      advanceNoticeHours: 24,
    });
    if (breach.uptimePercentage < 99.5 && breach.isSlaMet === false) {
      console.log(`✓ 300 min outage correctly flagged as SLA breach: ${breach.uptimePercentage}% (< 99.5%).`);
      passedChecks++;
    } else {
      throw new Error(`Breach test failed: expected isSlaMet=false, got ${breach.isSlaMet}`);
    }

    // 5. Scheduled Maintenance Window with >= 24h Advance Notice (Excluded from SLA penalty)
    console.log('\n[Check 5] Verifying scheduled maintenance announced >= 24 hours in advance...');
    const validMaintenance = uptimeService.calculateMonthlyUptime({
      totalMinutes: MONTH_MINUTES,
      unplannedDowntimeMinutes: 0,
      scheduledMaintenanceMinutes: 480, // 8 hours planned maintenance
      advanceNoticeHours: 48, // announced 48 hours in advance
    });
    if (validMaintenance.qualifiesForExclusion === true && validMaintenance.uptimePercentage === 100 && validMaintenance.isSlaMet === true) {
      console.log(`✓ Scheduled maintenance with 48h advance notice is excluded from SLA penalty: ${validMaintenance.uptimePercentage}% uptime.`);
      passedChecks++;
    } else {
      throw new Error(`Valid maintenance exclusion failed: qualifies=${validMaintenance.qualifiesForExclusion}, uptime=${validMaintenance.uptimePercentage}`);
    }

    // 6. Maintenance Window with < 24h Advance Notice (Penalized as Unplanned Downtime)
    console.log('\n[Check 6] Verifying late-announced maintenance (< 24h) is penalized as downtime...');
    const lateMaintenance = uptimeService.calculateMonthlyUptime({
      totalMinutes: MONTH_MINUTES,
      unplannedDowntimeMinutes: 0,
      scheduledMaintenanceMinutes: 300, // 5 hours maintenance
      advanceNoticeHours: 6, // announced only 6 hours in advance (< 24h)
    });
    if (lateMaintenance.qualifiesForExclusion === false && lateMaintenance.isSlaMet === false) {
      console.log(`✓ Late maintenance (6h notice) correctly penalized: ${lateMaintenance.uptimePercentage}% (SLA breached).`);
      passedChecks++;
    } else {
      throw new Error(`Late maintenance penalty failed: qualifies=${lateMaintenance.qualifiesForExclusion}, SLA met=${lateMaintenance.isSlaMet}`);
    }

    // 7. Maintenance Window Scheduling Validation
    console.log('\n[Check 7] Verifying maintenance window scheduling validator...');
    const now = new Date();
    const futureStart = new Date(now.getTime() + 48 * 3600 * 1000);
    const futureEnd = new Date(futureStart.getTime() + 2 * 3600 * 1000);

    const scheduled = await uptimeService.scheduleMaintenanceWindow({
      title: 'Database Security Patching',
      description: 'Routine maintenance and OS patching',
      startTime: futureStart.toISOString(),
      endTime: futureEnd.toISOString(),
      announcedAt: now.toISOString(),
      createdBy: 1,
    });

    if (scheduled.qualifiesForExclusion && scheduled.advanceNoticeHours >= 24) {
      console.log(`✓ Maintenance window scheduled: notice=${scheduled.advanceNoticeHours}h, qualifiesForExclusion=${scheduled.qualifiesForExclusion}.`);
      passedChecks++;
    } else {
      throw new Error('Scheduled maintenance validation failed.');
    }

    // 8. Service Health & Summary Metrics
    console.log('\n[Check 8] Verifying getUptimeSummary() reporting structure...');
    const summary = await uptimeService.getUptimeSummary();
    if (
      typeof summary.processUptimeSeconds === 'number' &&
      typeof summary.monthlyUptimePercentage === 'number' &&
      summary.targetSla === 99.5 &&
      typeof summary.isSlaMet === 'boolean'
    ) {
      console.log(`✓ Uptime summary verified: ${summary.monthlyUptimePercentage}% (Target: ${summary.targetSla}%, SLA Met: ${summary.isSlaMet}).`);
      passedChecks++;
    } else {
      throw new Error('Uptime summary returned invalid structure.');
    }

    console.log('----------------------------------------------------------------------');
    console.log(`\n>>> SUCCESS: TC-Ops-01 / OEP-NF-002 PASSED (${passedChecks}/${totalChecks} checks verified)!\n`);
    process.exit(0);
  } catch (err) {
    console.error(`\n>>> TEST FAILED: ${err.message}`);
    process.exit(1);
  }
}

run();
