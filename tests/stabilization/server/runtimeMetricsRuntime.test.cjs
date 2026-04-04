const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeRuntimeMetricsApplicationContext,
  buildRuntimeMetricsSnapshot,
  buildRuntimeMetricsHealthSnapshot,
  createRuntimeMetricsRuntime,
} = require('../../../server/src/monitoring/runtimeMetricsRuntime');

test('runtime metrics runtime normalizes application context defaults for health checks', () => {
  const application = normalizeRuntimeMetricsApplicationContext({
    appName: '/guild',
    onlineUsers: undefined,
    voice: { activeChannels: 3 },
    mediasoup: { workerCount: 2 },
    db: { recent: { messages_5m: 8 } },
  });

  assert.deepEqual(application, {
    appName: '/guild',
    onlineUsers: 0,
    voice: { activeChannels: 3 },
    mediasoup: {
      workerCount: 2,
      targetWorkerCount: 0,
      workersAvailable: true,
      recoveryPending: false,
      degraded: false,
    },
    db: {
      counts: {},
      recent: { messages_5m: 8 },
    },
  });
});

test('runtime metrics runtime shapes snapshots and health payloads canonically', () => {
  const snapshot = buildRuntimeMetricsSnapshot({
    generatedAt: '2026-03-26T10:15:30.000Z',
    health: {
      overall: 'warn',
      checks: [{ id: 'voice-workers', status: 'warn' }],
    },
    host: { hostname: 'guild-host' },
    process: { pid: 1234 },
    traffic: { http: { requestsLast1m: 9 } },
    application: { onlineUsers: 4 },
    recentNotes: Array.from({ length: 21 }, (_, index) => ({ message: `note-${index}` })),
    timezone: 'America/Los_Angeles',
  });

  assert.equal(snapshot.recentNotes.length, 20);
  assert.equal(snapshot.recentNotes[0].message, 'note-0');
  assert.equal(snapshot.recentNotes[19].message, 'note-19');
  assert.deepEqual(snapshot.formatting, {
    byteUnits: 'binary',
    timezone: 'America/Los_Angeles',
  });

  const health = buildRuntimeMetricsHealthSnapshot(snapshot, (currentSnapshot) => ({
    onlineUsers: currentSnapshot.application.onlineUsers,
    activeSockets: currentSnapshot.traffic.http.requestsLast1m,
  }));

  assert.deepEqual(health, {
    generatedAt: '2026-03-26T10:15:30.000Z',
    overall: 'warn',
    checks: [{ id: 'voice-workers', status: 'warn' }],
    summary: {
      onlineUsers: 4,
      activeSockets: 9,
    },
  });
});

test('runtime metrics runtime factory wires host, process, traffic, and summary helpers together', () => {
  const notes = [{ at: '2026-03-26T10:00:00.000Z', message: 'recent note' }];
  const state = { notes };

  const runtime = createRuntimeMetricsRuntime({
    state,
    addNote: () => {},
    sumEventsSince: () => 7,
    valuesSince: () => [100, 200],
    average: (values) => values.reduce((sum, value) => sum + value, 0) / values.length,
    percentile: (values) => values.at(-1),
    buildSeries: (events) => events.map((event) => ({ timestamp: event.at, count: event.value || 1 })),
    safePct: (numerator, denominator) => (denominator ? numerator / denominator : 0),
    severity: (status) => ({ ok: 0, warn: 1, error: 2 }[status] ?? 0),
    buildHealthChecks: ({ application }) => [
      {
        id: 'voice-workers',
        status: application.voice.activeChannels > 0 ? 'warn' : 'ok',
      },
    ],
    deriveOverallStatus: (checks) => checks[0].status,
    buildHealthSnapshotSummary: (snapshot) => ({
      onlineUsers: snapshot.application.onlineUsers,
      voiceChannels: snapshot.application.voice.activeChannels,
    }),
    buildTrafficSnapshot: () => ({
      http: { requestsLast1m: 7, p95LatencyMsLast5m: 200 },
      sockets: { currentConnections: 2 },
      voice: { errorsLast5m: 0 },
    }),
    buildHostSnapshot: () => ({
      host: {
        hostname: 'guild-host',
        memory: { usedPct: 0.42, usedBytes: 42, totalBytes: 100 },
      },
      hostMemoryTotal: 100,
    }),
    buildProcessSnapshot: () => ({
      pid: 4321,
      eventLoopDelayMs: { p95: 10 },
    }),
    diskProbePath: '/srv',
    eventLoopHistogram: {
      mean: 0,
      percentile: () => 0,
      max: 0,
    },
    processModule: {
      pid: 4321,
      version: 'v22.0.0',
      uptime: () => 99,
      memoryUsage: () => ({ rss: 1, heapTotal: 1, heapUsed: 1, external: 1, arrayBuffers: 1 }),
    },
    osModule: {
      totalmem: () => 100,
      freemem: () => 58,
      hostname: () => 'guild-host',
      platform: () => 'linux',
      release: () => '6.0',
      arch: () => 'x64',
      uptime: () => 99,
      loadavg: () => [0, 0, 0],
      cpus: () => [{}],
      networkInterfaces: () => ({}),
      statfsSync: () => ({ blocks: 1, bsize: 1, bavail: 1 }),
    },
    fsModule: {
      statfsSync: () => ({ blocks: 1, bsize: 1, bavail: 1 }),
    },
    nowIsoFn: () => '2026-03-26T10:15:30.000Z',
    timezoneFn: () => 'America/Los_Angeles',
  });

  const snapshot = runtime.getSnapshot({
    appName: '/guild',
    voice: { activeChannels: 2 },
    mediasoup: { workerCount: 1, targetWorkerCount: 1 },
  });

  assert.equal(snapshot.generatedAt, '2026-03-26T10:15:30.000Z');
  assert.equal(snapshot.application.onlineUsers, 0);
  assert.equal(snapshot.application.voice.activeChannels, 2);
  assert.equal(snapshot.health.overall, 'warn');
  assert.equal(snapshot.recentNotes.length, 1);
  assert.equal(snapshot.formatting.timezone, 'America/Los_Angeles');

  const health = runtime.getHealthSnapshot({
    appName: '/guild',
    voice: { activeChannels: 2 },
    mediasoup: { workerCount: 1, targetWorkerCount: 1 },
  });

  assert.deepEqual(health, {
    generatedAt: '2026-03-26T10:15:30.000Z',
    overall: 'warn',
    checks: [{ id: 'voice-workers', status: 'warn' }],
    summary: {
      onlineUsers: 0,
      voiceChannels: 2,
    },
  });
});
