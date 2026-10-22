/**
 * Automated Load & Performance Test for OEP-NF-001: Response Time Under Load
 *
 * Test Case Traceability: STP TC-Perf-01 / SRS OEP-NF-001
 *
 * Verifies:
 * 1. System processes 100 concurrent user requests.
 * 2. Response times are captured for user actions (system status, CSRF tokens, public endpoints).
 * 3. 95th percentile (p95) response time is <= 3.0 seconds under 100 concurrent users.
 * 4. Error rate under load is 0%.
 */

require('dotenv').config();
const { performance } = require('perf_hooks');

const BASE_URL = process.env.APP_URL || 'http://localhost:3000';
const CONCURRENT_USERS = 100;
const P95_THRESHOLD_MS = 3000;

async function executeRequest(endpoint, index) {
  const start = performance.now();
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`);
    const duration = performance.now() - start;
    return {
      index,
      endpoint,
      status: res.status,
      ok: res.ok,
      durationMs: duration,
    };
  } catch (err) {
    const duration = performance.now() - start;
    return {
      index,
      endpoint,
      status: 0,
      ok: false,
      error: err.message,
      durationMs: duration,
    };
  }
}

function calculatePercentile(sortedValues, percentile) {
  if (sortedValues.length === 0) return 0;
  const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
}

async function run() {
  console.log('======================================================================');
  console.log(`=== Starting Load Test: OEP-NF-001 (TC-Perf-01 Response Time Under Load) ===`);
  console.log(`Target: 100 Concurrent Users | Threshold: p95 <= ${P95_THRESHOLD_MS} ms`);
  console.log('======================================================================\n');

  const endpoints = [
    '/api/health',
    '/api/auth/csrf-token',
    '/index.html',
    '/student/dashboard.html',
  ];

  // Distribute 100 concurrent requests across typical user interaction paths
  const tasks = [];
  for (let i = 0; i < CONCURRENT_USERS; i++) {
    const endpoint = endpoints[i % endpoints.length];
    tasks.push(executeRequest(endpoint, i + 1));
  }

  const startTime = performance.now();
  const results = await Promise.all(tasks);
  const totalWallTime = performance.now() - startTime;

  const successful = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);
  const durations = results.map((r) => r.durationMs).sort((a, b) => a - b);

  const min = durations[0];
  const max = durations[durations.length - 1];
  const sum = durations.reduce((acc, v) => acc + v, 0);
  const mean = sum / durations.length;

  const p50 = calculatePercentile(durations, 50);
  const p90 = calculatePercentile(durations, 90);
  const p95 = calculatePercentile(durations, 95);
  const p99 = calculatePercentile(durations, 99);

  console.log('--- Performance Test Results ---');
  console.log(`Total Concurrent Requests: ${results.length}`);
  console.log(`Successful Requests:        ${successful.length} (${((successful.length / results.length) * 100).toFixed(1)}%)`);
  console.log(`Failed Requests:            ${failed.length}`);
  console.log(`Total Elapsed Time:         ${totalWallTime.toFixed(2)} ms`);
  console.log(`Throughput:                 ${((results.length / totalWallTime) * 1000).toFixed(2)} req/sec`);
  console.log('');
  console.log('--- Latency Distribution ---');
  console.log(`Min Latency:                ${min.toFixed(2)} ms`);
  console.log(`Mean Latency:               ${mean.toFixed(2)} ms`);
  console.log(`Median (p50):               ${p50.toFixed(2)} ms`);
  console.log(`90th Percentile (p90):      ${p90.toFixed(2)} ms`);
  console.log(`95th Percentile (p95):      ${p95.toFixed(2)} ms`);
  console.log(`99th Percentile (p99):      ${p99.toFixed(2)} ms`);
  console.log(`Max Latency:                ${max.toFixed(2)} ms`);
  console.log('----------------------------------------------------------------------');

  if (failed.length > 0) {
    console.error(`\n>>> FAILED: ${failed.length} requests failed under load.`);
    process.exit(1);
  }

  if (p95 > P95_THRESHOLD_MS) {
    console.error(`\n>>> FAILED: 95th percentile (${p95.toFixed(2)} ms) exceeded threshold of ${P95_THRESHOLD_MS} ms.`);
    process.exit(1);
  }

  console.log(`\n>>> SUCCESS: TC-Perf-01 / OEP-NF-001 PASSED! 95% response time is ${p95.toFixed(2)} ms (<= ${P95_THRESHOLD_MS} ms).\n`);
  process.exit(0);
}

run();
