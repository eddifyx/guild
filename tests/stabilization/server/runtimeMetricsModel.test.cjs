const test = require('node:test');
const assert = require('node:assert/strict');

const {
  average,
  percentile,
  classifyStatus,
  normalizeUrl,
  buildSeries,
  safePct,
  severity,
  formatBytes,
  buildHealthChecks,
} = require('../../../server/src/monitoring/runtimeMetricsModel');

test('runtime metrics model normalizes urls, status classes, percentages, and byte labels consistently', () => {
  assert.equal(classifyStatus(204), '2xx');
  assert.equal(classifyStatus(404), '4xx');
  assert.equal(classifyStatus(999), 'other');
  assert.equal(
    normalizeUrl('/api/messages/123e4567-e89b-12d3-a456-426614174000/42?tab=1'),
    '/api/messages/:id/:id',
  );
  assert.equal(safePct(4, 0), 0);
  assert.equal(safePct(2, 8), 0.25);
  assert.equal(formatBytes(500), '500 B');
  assert.equal(formatBytes(2048), '2.00 KB');
  assert.equal(severity('warn'), 1);
  assert.equal(severity('error'), 2);
});

test('runtime metrics model builds series and latency summaries predictably', () => {
  const now = Date.now();
  const realNow = Date.now;
  Date.now = () => now;

  try {
    const series = buildSeries([
      { at: now - 120_000, value: 2 },
      { at: now - 60_000, value: 3 },
      { at: now, value: 1 },
    ], { buckets: 3, bucketMs: 60_000 });

    assert.deepEqual(series.map((entry) => entry.count), [2, 3, 1]);
    assert.equal(average([10, 20, 30]), 20);
    assert.equal(percentile([10, 20, 30, 40], 95), 40);
    assert.equal(percentile([], 95), null);
  } finally {
    Date.now = realNow;
  }
});

test('runtime metrics model derives warn and error health checks from traffic and voice state', () => {
  const checks = buildHealthChecks({
    host: {
      memory: {
        usedPct: 0.85,
        usedBytes: 850,
        totalBytes: 1000,
      },
      disk: {
        usedPct: 0.95,
        usedBytes: 950,
        totalBytes: 1000,
      },
    },
    processStats: {
      eventLoopDelayMs: {
        p95: 300,
      },
    },
    traffic: {
      http: {
        requestsLast5m: 25,
        p95LatencyMsLast5m: 1200,
        errorRateLast5m: 0.12,
        errorsLast5m: 3,
      },
      voice: {
        errorsLast5m: 21,
      },
      sockets: {
        authFailuresLast5m: 25,
      },
    },
    application: {
      mediasoup: {
        workerCount: 0,
        targetWorkerCount: 2,
        recoveryPending: false,
        workersAvailable: false,
      },
      voice: {
        activeChannels: 2,
      },
    },
  });

  const byId = Object.fromEntries(checks.map((check) => [check.id, check]));
  assert.equal(byId['api-latency'].status, 'error');
  assert.equal(byId['http-errors'].status, 'error');
  assert.equal(byId['event-loop'].status, 'error');
  assert.equal(byId['host-memory'].status, 'warn');
  assert.equal(byId.disk.status, 'error');
  assert.equal(byId['voice-workers'].status, 'error');
  assert.equal(byId['voice-errors'].status, 'error');
  assert.equal(byId['socket-auth'].status, 'warn');
});
