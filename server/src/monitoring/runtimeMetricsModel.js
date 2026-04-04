const DEFAULT_SERIES_BUCKET_MS = 60_000;
const DEFAULT_SERIES_BUCKETS = 60;

function average(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(values, pct) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((pct / 100) * sorted.length) - 1));
  return sorted[index];
}

function classifyStatus(statusCode) {
  if (statusCode >= 200 && statusCode < 300) return '2xx';
  if (statusCode >= 300 && statusCode < 400) return '3xx';
  if (statusCode >= 400 && statusCode < 500) return '4xx';
  if (statusCode >= 500 && statusCode < 600) return '5xx';
  return 'other';
}

function normalizeUrl(url = '/') {
  const pathOnly = String(url).split('?')[0] || '/';
  return pathOnly
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, ':id')
    .replace(/\/\d+(?=\/|$)/g, '/:id');
}

function buildSeries(events, {
  buckets = DEFAULT_SERIES_BUCKETS,
  bucketMs = DEFAULT_SERIES_BUCKET_MS,
  field = 'value',
} = {}) {
  const now = Date.now();
  const firstBucketStart = now - ((buckets - 1) * bucketMs);
  const series = Array.from({ length: buckets }, (_, index) => ({
    timestamp: new Date(firstBucketStart + (index * bucketMs)).toISOString(),
    count: 0,
  }));

  for (const event of events) {
    if (event.at < firstBucketStart) continue;
    const index = Math.floor((event.at - firstBucketStart) / bucketMs);
    if (index < 0 || index >= series.length) continue;
    series[index].count += typeof event[field] === 'number' ? event[field] : 1;
  }

  return series;
}

function safePct(numerator, denominator) {
  if (!denominator) return 0;
  return numerator / denominator;
}

function buildCheck(id, label, status, value, note = '') {
  return { id, label, status, value, note };
}

function severity(status) {
  if (status === 'error') return 2;
  if (status === 'warn') return 1;
  return 0;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return 'n/a';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}

function buildHealthChecks({ host, processStats, traffic, application }) {
  const checks = [];

  const httpReq5m = traffic.http.requestsLast5m;
  const latencyP95 = traffic.http.p95LatencyMsLast5m;
  const latencyStatus = latencyP95 === null
    ? 'ok'
    : latencyP95 > 1000
      ? 'error'
      : latencyP95 > 400
        ? 'warn'
        : 'ok';
  checks.push(buildCheck(
    'api-latency',
    'API latency',
    latencyStatus,
    latencyP95 === null ? 'idle' : `${latencyP95.toFixed(0)} ms p95`,
    httpReq5m ? 'rolling 5 minute window' : 'no recent requests',
  ));

  const errorRate = traffic.http.errorRateLast5m;
  const errorStatus = errorRate > 0.1 ? 'error' : errorRate > 0.03 ? 'warn' : 'ok';
  checks.push(buildCheck(
    'http-errors',
    'HTTP errors',
    errorStatus,
    `${(errorRate * 100).toFixed(1)}%`,
    `${traffic.http.errorsLast5m} errors in last 5m`,
  ));

  const eventLoopP95 = processStats.eventLoopDelayMs.p95;
  const eventLoopStatus = eventLoopP95 > 250 ? 'error' : eventLoopP95 > 100 ? 'warn' : 'ok';
  checks.push(buildCheck(
    'event-loop',
    'Event loop',
    eventLoopStatus,
    `${eventLoopP95.toFixed(1)} ms p95`,
    'Node main thread responsiveness',
  ));

  const hostMemoryPct = host.memory.usedPct;
  const memoryStatus = hostMemoryPct > 0.9 ? 'error' : hostMemoryPct > 0.8 ? 'warn' : 'ok';
  checks.push(buildCheck(
    'host-memory',
    'Host memory',
    memoryStatus,
    `${(hostMemoryPct * 100).toFixed(1)}% used`,
    `${formatBytes(host.memory.usedBytes)} / ${formatBytes(host.memory.totalBytes)}`,
  ));

  if (host.disk) {
    const diskStatus = host.disk.usedPct > 0.92 ? 'error' : host.disk.usedPct > 0.82 ? 'warn' : 'ok';
    checks.push(buildCheck(
      'disk',
      'Disk usage',
      diskStatus,
      `${(host.disk.usedPct * 100).toFixed(1)}% used`,
      `${formatBytes(host.disk.usedBytes)} / ${formatBytes(host.disk.totalBytes)}`,
    ));
  }

  const workerCount = application.mediasoup.workerCount || 0;
  const targetWorkerCount = application.mediasoup.targetWorkerCount || workerCount || 0;
  const recoveryPending = !!application.mediasoup.recoveryPending;
  const workersAvailable = application.mediasoup.workersAvailable !== false;
  const activeVoiceChannels = application.voice.activeChannels || 0;
  const voiceStatus = workerCount === 0 && activeVoiceChannels > 0
    ? 'error'
    : workerCount === 0
      ? 'warn'
      : workerCount < targetWorkerCount
        ? 'warn'
        : recoveryPending
          ? 'warn'
          : !workersAvailable
            ? 'warn'
            : 'ok';
  checks.push(buildCheck(
    'voice-workers',
    'Voice workers',
    voiceStatus,
    `${workerCount}/${targetWorkerCount || workerCount} workers`,
    recoveryPending
      ? 'worker recovery in progress'
      : activeVoiceChannels > 0
        ? `${activeVoiceChannels} live voice channels`
        : 'voice stack idle',
  ));

  const voiceErrorsLast5m = traffic.voice.errorsLast5m;
  const voiceErrorsStatus = voiceErrorsLast5m > 20 ? 'error' : voiceErrorsLast5m > 5 ? 'warn' : 'ok';
  checks.push(buildCheck(
    'voice-errors',
    'Voice errors',
    voiceErrorsStatus,
    `${voiceErrorsLast5m} errors`,
    'rolling 5 minute window',
  ));

  const socketAuthFailures = traffic.sockets.authFailuresLast5m;
  const socketStatus = socketAuthFailures > 20 ? 'warn' : 'ok';
  checks.push(buildCheck(
    'socket-auth',
    'Socket auth',
    socketStatus,
    `${socketAuthFailures} failures`,
    'rolling 5 minute window',
  ));

  return checks;
}

module.exports = {
  average,
  percentile,
  classifyStatus,
  normalizeUrl,
  buildSeries,
  safePct,
  buildCheck,
  severity,
  formatBytes,
  buildHealthChecks,
};
