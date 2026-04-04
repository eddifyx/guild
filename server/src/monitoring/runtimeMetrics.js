const fs = require('fs');
const os = require('os');
const path = require('path');
const { monitorEventLoopDelay } = require('perf_hooks');
const {
  createRuntimeMetricsState,
  pushEvent,
  addNote,
  sumEventsSince,
  valuesSince,
} = require('./runtimeMetricsState');
const {
  buildHostSnapshot,
  buildProcessSnapshot,
} = require('./runtimeMetricsHostRuntime');
const {
  createRuntimeMetricsRecorder,
} = require('./runtimeMetricsRecorder');
const {
  average,
  percentile,
  classifyStatus,
  normalizeUrl,
  buildSeries,
  safePct,
  severity,
  buildHealthChecks,
} = require('./runtimeMetricsModel');
const {
  buildTrafficSnapshot,
  deriveOverallStatus,
  buildHealthSnapshotSummary,
} = require('./runtimeMetricsSnapshotModel');
const {
  createRuntimeMetricsRuntime,
} = require('./runtimeMetricsRuntime');

const repoRoot = path.join(__dirname, '..', '..', '..');
const diskProbePath = path.join(repoRoot, 'server');

const eventLoopHistogram = monitorEventLoopDelay({ resolution: 20 });
eventLoopHistogram.enable();

const state = createRuntimeMetricsState();
const recorder = createRuntimeMetricsRecorder({
  state,
  addNote,
  pushEvent,
  classifyStatus,
  normalizeUrl,
});
const runtime = createRuntimeMetricsRuntime({
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
  osModule: os,
  fsModule: fs,
});

module.exports = {
  ...recorder,
  ...runtime,
};
