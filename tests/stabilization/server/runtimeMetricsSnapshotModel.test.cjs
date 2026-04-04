const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildTrafficSnapshot,
  deriveOverallStatus,
  buildHealthSnapshotSummary,
} = require('../../../server/src/monitoring/runtimeMetricsSnapshotModel');

test('runtime metrics snapshot model builds traffic summaries from recorder state', () => {
  const state = {
    http: {
      inflight: 2,
      total: 9,
      requests: [{ at: 1, value: 2 }],
      errors: [{ at: 1, value: 1 }],
      latencies: [{ at: 1, ms: 120 }, { at: 2, ms: 180 }],
      statusClasses: { '2xx': 8, '5xx': 1 },
    },
    sockets: {
      currentConnections: 4,
      totalConnections: 7,
      totalDisconnections: 3,
      authSuccessesTotal: 5,
      authFailuresTotal: 2,
      connections: [{ at: 1, value: 3 }],
      disconnections: [{ at: 1, value: 1 }],
      authFailures: [{ at: 1, value: 2 }],
    },
    chat: {
      roomMessagesTotal: 12,
      dmMessagesTotal: 6,
      handlerErrorsTotal: 1,
      roomMessages: [{ at: 1, value: 4 }],
      dmMessages: [{ at: 1, value: 3 }],
      events: Array.from({ length: 25 }, (_, index) => ({ kind: 'chat', index })),
    },
    voice: {
      joinsTotal: 8,
      leavesTotal: 5,
      producesTotal: 4,
      consumesTotal: 9,
      errorsTotal: 2,
      joins: [{ at: 1, value: 2 }],
      leaves: [{ at: 1, value: 1 }],
      produces: [{ at: 1, value: 1 }],
      errors: [{ at: 1, value: 2 }],
      events: Array.from({ length: 22 }, (_, index) => ({ kind: 'voice', index })),
    },
  };

  const traffic = buildTrafficSnapshot({
    state,
    sumEventsSinceFn: (events) => events.reduce((sum, event) => sum + (event.value || 1), 0),
    valuesSinceFn: (events, _windowMs, field) => events.map((event) => event[field]),
    averageFn: (values) => values.reduce((sum, value) => sum + value, 0) / values.length,
    percentileFn: (values) => Math.max(...values),
    buildSeriesFn: (events) => events.map((event) => ({ timestamp: event.at, count: event.value || 1 })),
    safePctFn: (numerator, denominator) => (denominator ? numerator / denominator : 0),
  });

  assert.equal(traffic.http.requestsLast1m, 2);
  assert.equal(traffic.http.errorsLast5m, 1);
  assert.equal(traffic.http.errorRateLast5m, 0.5);
  assert.equal(traffic.http.avgLatencyMsLast5m, 150);
  assert.equal(traffic.http.p95LatencyMsLast5m, 180);
  assert.equal(traffic.sockets.authFailuresLast5m, 2);
  assert.equal(traffic.chat.recentEvents.length, 20);
  assert.equal(traffic.chat.recentEvents[0].index, 5);
  assert.equal(traffic.voice.recentEvents.length, 20);
  assert.equal(traffic.voice.recentEvents[0].index, 2);
});

test('runtime metrics snapshot model derives overall health severity and summary values', () => {
  assert.equal(deriveOverallStatus([
    { status: 'ok' },
    { status: 'warn' },
    { status: 'error' },
  ], (status) => ({ ok: 0, warn: 1, error: 2 }[status] ?? 0)), 'error');

  const summary = buildHealthSnapshotSummary({
    application: {
      onlineUsers: 14,
      voice: { activeChannels: 3 },
      mediasoup: {
        workerCount: 2,
        targetWorkerCount: 4,
        workersAvailable: true,
        degraded: true,
        recoveryPending: false,
      },
    },
    traffic: {
      sockets: { currentConnections: 11 },
      http: { requestsLast1m: 21, p95LatencyMsLast5m: 345 },
      voice: { errorsLast5m: 6 },
    },
  });

  assert.deepEqual(summary, {
    onlineUsers: 14,
    activeSockets: 11,
    requestsLast1m: 21,
    p95LatencyMsLast5m: 345,
    activeVoiceChannels: 3,
    voiceWorkerCount: 2,
    voiceWorkerTarget: 4,
    voiceWorkersAvailable: true,
    voiceDegraded: true,
    voiceRecoveryPending: false,
    voiceErrorsLast5m: 6,
  });
});
