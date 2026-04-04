const fs = require('fs');
const os = require('os');
const processObj = require('process');

function normalizeRuntimeMetricsApplicationContext(context = {}) {
  return {
    ...context,
    onlineUsers: context.onlineUsers ?? 0,
    voice: {
      activeChannels: 0,
      ...(context.voice || {}),
    },
    mediasoup: {
      workerCount: 0,
      targetWorkerCount: 0,
      workersAvailable: true,
      recoveryPending: false,
      degraded: false,
      ...(context.mediasoup || {}),
    },
    db: {
      counts: {},
      recent: {},
      ...(context.db || {}),
    },
  };
}

function buildRuntimeMetricsSnapshot({
  generatedAt,
  health,
  host,
  process,
  traffic,
  application,
  recentNotes,
  timezone,
}) {
  return {
    generatedAt,
    health,
    host,
    process,
    traffic,
    application,
    recentNotes: recentNotes.slice(0, 20),
    formatting: {
      byteUnits: 'binary',
      timezone,
    },
  };
}

function buildRuntimeMetricsHealthSnapshot(snapshot, buildHealthSnapshotSummaryFn) {
  return {
    generatedAt: snapshot.generatedAt,
    overall: snapshot.health.overall,
    checks: snapshot.health.checks,
    summary: buildHealthSnapshotSummaryFn(snapshot),
  };
}

function createRuntimeMetricsRuntime({
  state,
  addNote,
  sumEventsSince,
  valuesSince,
  average,
  percentile,
  buildSeries,
  safePct,
  severity,
  buildHealthChecks,
  deriveOverallStatus,
  buildHealthSnapshotSummary,
  buildTrafficSnapshot,
  buildHostSnapshot,
  buildProcessSnapshot,
  diskProbePath,
  eventLoopHistogram,
  osModule = os,
  fsModule = fs,
  processModule = processObj,
  nowIsoFn = () => new Date().toISOString(),
  timezoneFn = () => Intl.DateTimeFormat().resolvedOptions().timeZone,
}) {
  function getSnapshot(context = {}) {
    const processMemory = processModule.memoryUsage();
    const { host, hostMemoryTotal } = buildHostSnapshot({
      osModule: {
        ...osModule,
        statfsSync: typeof fsModule.statfsSync === 'function' ? fsModule.statfsSync : null,
      },
      processMemory,
      diskProbePath,
      safePctFn: safePct,
      onDiskError: (error) => addNote(state, 'warn', 'disk usage probe failed', { message: error.message }),
    });

    const traffic = buildTrafficSnapshot({
      state,
      sumEventsSinceFn: sumEventsSince,
      valuesSinceFn: valuesSince,
      averageFn: average,
      percentileFn: percentile,
      buildSeriesFn: buildSeries,
      safePctFn: safePct,
    });

    const processStats = buildProcessSnapshot({
      processObj: processModule,
      processMemory,
      hostMemoryTotal,
      eventLoopHistogram,
      safePctFn: safePct,
    });

    const application = normalizeRuntimeMetricsApplicationContext(context);
    const checks = buildHealthChecks({ host, processStats, traffic, application });
    const overall = deriveOverallStatus(checks, severity);

    return buildRuntimeMetricsSnapshot({
      generatedAt: nowIsoFn(),
      health: {
        overall,
        checks,
      },
      host,
      process: processStats,
      traffic,
      application,
      recentNotes: state.notes,
      timezone: timezoneFn(),
    });
  }

  function getHealthSnapshot(context = {}) {
    const snapshot = getSnapshot(context);
    return buildRuntimeMetricsHealthSnapshot(snapshot, buildHealthSnapshotSummary);
  }

  return {
    getSnapshot,
    getHealthSnapshot,
  };
}

module.exports = {
  normalizeRuntimeMetricsApplicationContext,
  buildRuntimeMetricsSnapshot,
  buildRuntimeMetricsHealthSnapshot,
  createRuntimeMetricsRuntime,
};
