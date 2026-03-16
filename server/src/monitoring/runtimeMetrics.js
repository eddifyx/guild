const fs = require('fs');
const os = require('os');
const path = require('path');
const { monitorEventLoopDelay } = require('perf_hooks');

const MAX_TIMELINE_AGE_MS = 6 * 60 * 60 * 1000;
const MAX_RECENT_NOTES = 60;
const SERIES_BUCKET_MS = 60_000;
const SERIES_BUCKETS = 60;

const repoRoot = path.join(__dirname, '..', '..', '..');
const diskProbePath = path.join(repoRoot, 'server');

const eventLoopHistogram = monitorEventLoopDelay({ resolution: 20 });
eventLoopHistogram.enable();

const state = {
  http: {
    inflight: 0,
    total: 0,
    statusClasses: {
      '2xx': 0,
      '3xx': 0,
      '4xx': 0,
      '5xx': 0,
      other: 0,
    },
    requests: [],
    errors: [],
    latencies: [],
  },
  sockets: {
    currentConnections: 0,
    totalConnections: 0,
    totalDisconnections: 0,
    authSuccessesTotal: 0,
    authFailuresTotal: 0,
    connections: [],
    disconnections: [],
    authFailures: [],
  },
  chat: {
    roomMessagesTotal: 0,
    dmMessagesTotal: 0,
    handlerErrorsTotal: 0,
    roomMessages: [],
    dmMessages: [],
    handlerErrors: [],
  },
  voice: {
    joinsTotal: 0,
    leavesTotal: 0,
    producesTotal: 0,
    consumesTotal: 0,
    errorsTotal: 0,
    joins: [],
    leaves: [],
    produces: [],
    consumes: [],
    errors: [],
  },
  notes: [],
};

function trimTimeline(events, now = Date.now()) {
  const cutoff = now - MAX_TIMELINE_AGE_MS;
  while (events.length && events[0].at < cutoff) {
    events.shift();
  }
}

function pushEvent(events, payload = {}) {
  const event = { at: Date.now(), ...payload };
  events.push(event);
  trimTimeline(events, event.at);
  return event;
}

function addNote(level, message, details = null) {
  state.notes.unshift({
    at: new Date().toISOString(),
    level,
    message,
    details,
  });
  if (state.notes.length > MAX_RECENT_NOTES) {
    state.notes.length = MAX_RECENT_NOTES;
  }
}

function sumEventsSince(events, windowMs, predicate = null) {
  const now = Date.now();
  trimTimeline(events, now);
  let count = 0;
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    if (event.at < now - windowMs) break;
    if (!predicate || predicate(event)) count += event.value || 1;
  }
  return count;
}

function valuesSince(events, windowMs, field) {
  const now = Date.now();
  trimTimeline(events, now);
  const values = [];
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    if (event.at < now - windowMs) break;
    if (typeof event[field] === 'number' && Number.isFinite(event[field])) {
      values.push(event[field]);
    }
  }
  return values;
}

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

function toMs(nanoseconds) {
  if (!Number.isFinite(nanoseconds)) return null;
  return nanoseconds / 1e6;
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

function buildSeries(events, { buckets = SERIES_BUCKETS, bucketMs = SERIES_BUCKET_MS, field = 'value' } = {}) {
  const now = Date.now();
  trimTimeline(events, now);

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

function readDiskUsage(targetPath) {
  if (typeof fs.statfsSync !== 'function') return null;

  try {
    const stats = fs.statfsSync(targetPath);
    const totalBytes = Number(stats.blocks) * Number(stats.bsize);
    const freeBytes = Number(stats.bavail) * Number(stats.bsize);
    const usedBytes = totalBytes - freeBytes;

    return {
      path: targetPath,
      totalBytes,
      freeBytes,
      usedBytes,
      usedPct: totalBytes > 0 ? usedBytes / totalBytes : 0,
    };
  } catch (error) {
    addNote('warn', 'disk usage probe failed', { message: error.message });
    return null;
  }
}

function summarizeNetworkInterfaces() {
  const interfaces = os.networkInterfaces();
  const results = [];

  for (const [name, entries] of Object.entries(interfaces)) {
    for (const entry of entries || []) {
      if (!entry) continue;
      results.push({
        name,
        family: entry.family,
        address: entry.address,
        cidr: entry.cidr || null,
        internal: !!entry.internal,
        mac: entry.mac || null,
      });
    }
  }

  return results;
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
  const activeVoiceChannels = application.voice.activeChannels || 0;
  const voiceStatus = workerCount === 0 && activeVoiceChannels > 0
    ? 'error'
    : workerCount === 0
      ? 'warn'
      : 'ok';
  checks.push(buildCheck(
    'voice-workers',
    'Voice workers',
    voiceStatus,
    `${workerCount} workers`,
    activeVoiceChannels > 0 ? `${activeVoiceChannels} live voice channels` : 'voice stack idle',
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

function getSnapshot(context = {}) {
  const processMemory = process.memoryUsage();
  const hostMemoryTotal = os.totalmem();
  const hostMemoryFree = os.freemem();
  const hostMemoryUsed = hostMemoryTotal - hostMemoryFree;
  const disk = readDiskUsage(diskProbePath);

  const httpRequestsLast1m = sumEventsSince(state.http.requests, 60_000);
  const httpRequestsLast5m = sumEventsSince(state.http.requests, 5 * 60_000);
  const httpErrorsLast5m = sumEventsSince(state.http.errors, 5 * 60_000);
  const httpLatenciesLast5m = valuesSince(state.http.latencies, 5 * 60_000, 'ms');

  const traffic = {
    http: {
      inflight: state.http.inflight,
      total: state.http.total,
      requestsLast1m: httpRequestsLast1m,
      requestsLast5m: httpRequestsLast5m,
      errorsLast5m: httpErrorsLast5m,
      errorRateLast5m: safePct(httpErrorsLast5m, httpRequestsLast5m),
      avgLatencyMsLast5m: average(httpLatenciesLast5m),
      p95LatencyMsLast5m: percentile(httpLatenciesLast5m, 95),
      statusClasses: state.http.statusClasses,
      series: {
        requestsPerMinute: buildSeries(state.http.requests),
        errorsPerMinute: buildSeries(state.http.errors),
      },
    },
    sockets: {
      currentConnections: state.sockets.currentConnections,
      totalConnections: state.sockets.totalConnections,
      totalDisconnections: state.sockets.totalDisconnections,
      authSuccessesTotal: state.sockets.authSuccessesTotal,
      authFailuresTotal: state.sockets.authFailuresTotal,
      connectionsLast5m: sumEventsSince(state.sockets.connections, 5 * 60_000),
      disconnectionsLast5m: sumEventsSince(state.sockets.disconnections, 5 * 60_000),
      authFailuresLast5m: sumEventsSince(state.sockets.authFailures, 5 * 60_000),
      series: {
        connectionsPerMinute: buildSeries(state.sockets.connections),
        authFailuresPerMinute: buildSeries(state.sockets.authFailures),
      },
    },
    chat: {
      roomMessagesTotal: state.chat.roomMessagesTotal,
      dmMessagesTotal: state.chat.dmMessagesTotal,
      handlerErrorsTotal: state.chat.handlerErrorsTotal,
      roomMessagesLast1h: sumEventsSince(state.chat.roomMessages, 60 * 60_000),
      dmMessagesLast1h: sumEventsSince(state.chat.dmMessages, 60 * 60_000),
      series: {
        roomMessagesPerMinute: buildSeries(state.chat.roomMessages),
        dmMessagesPerMinute: buildSeries(state.chat.dmMessages),
      },
    },
    voice: {
      joinsTotal: state.voice.joinsTotal,
      leavesTotal: state.voice.leavesTotal,
      producesTotal: state.voice.producesTotal,
      consumesTotal: state.voice.consumesTotal,
      errorsTotal: state.voice.errorsTotal,
      joinsLast1h: sumEventsSince(state.voice.joins, 60 * 60_000),
      leavesLast1h: sumEventsSince(state.voice.leaves, 60 * 60_000),
      series: {
        joinsPerMinute: buildSeries(state.voice.joins),
        producesPerMinute: buildSeries(state.voice.produces),
      },
    },
  };

  const host = {
    hostname: os.hostname(),
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
    uptimeSec: os.uptime(),
    loadAverage: os.loadavg(),
    cpus: os.cpus().length,
    memory: {
      totalBytes: hostMemoryTotal,
      freeBytes: hostMemoryFree,
      usedBytes: hostMemoryUsed,
      usedPct: safePct(hostMemoryUsed, hostMemoryTotal),
    },
    disk,
    networkInterfaces: summarizeNetworkInterfaces(),
  };

  const processStats = {
    pid: process.pid,
    node: process.version,
    uptimeSec: process.uptime(),
    memory: {
      rssBytes: processMemory.rss,
      heapTotalBytes: processMemory.heapTotal,
      heapUsedBytes: processMemory.heapUsed,
      externalBytes: processMemory.external,
      arrayBuffersBytes: processMemory.arrayBuffers,
      rssPctOfHost: safePct(processMemory.rss, hostMemoryTotal),
    },
    eventLoopDelayMs: {
      mean: toMs(eventLoopHistogram.mean) || 0,
      p50: toMs(eventLoopHistogram.percentile(50)) || 0,
      p95: toMs(eventLoopHistogram.percentile(95)) || 0,
      max: toMs(eventLoopHistogram.max) || 0,
    },
  };

  const application = {
    ...context,
  };

  const checks = buildHealthChecks({ host, processStats, traffic, application });
  const overall = checks.reduce((current, check) => (
    severity(check.status) > severity(current) ? check.status : current
  ), 'ok');

  return {
    generatedAt: new Date().toISOString(),
    health: {
      overall,
      checks,
    },
    host,
    process: processStats,
    traffic,
    application,
    recentNotes: state.notes.slice(0, 20),
    formatting: {
      byteUnits: 'binary',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  };
}

function getHealthSnapshot(context = {}) {
  const snapshot = getSnapshot(context);
  return {
    generatedAt: snapshot.generatedAt,
    overall: snapshot.health.overall,
    checks: snapshot.health.checks,
    summary: {
      onlineUsers: snapshot.application.onlineUsers || 0,
      activeSockets: snapshot.traffic.sockets.currentConnections,
      requestsLast1m: snapshot.traffic.http.requestsLast1m,
      p95LatencyMsLast5m: snapshot.traffic.http.p95LatencyMsLast5m,
      activeVoiceChannels: snapshot.application.voice?.activeChannels || 0,
    },
  };
}

function beginHttpRequest() {
  state.http.inflight += 1;
}

function endHttpRequest({ method, url, statusCode, durationMs }) {
  state.http.inflight = Math.max(0, state.http.inflight - 1);
  state.http.total += 1;
  state.http.statusClasses[classifyStatus(statusCode)] += 1;
  pushEvent(state.http.requests, { method, url: normalizeUrl(url), value: 1 });
  pushEvent(state.http.latencies, { ms: durationMs, value: 1 });

  if (statusCode >= 400) {
    pushEvent(state.http.errors, { method, url: normalizeUrl(url), statusCode, value: 1 });
  }

  if (statusCode >= 500) {
    addNote('error', 'server returned 5xx', {
      method,
      url: normalizeUrl(url),
      statusCode,
      durationMs: Math.round(durationMs),
    });
  } else if (durationMs >= 1500) {
    addNote('warn', 'slow http request', {
      method,
      url: normalizeUrl(url),
      statusCode,
      durationMs: Math.round(durationMs),
    });
  }
}

function recordSocketAuthSuccess() {
  state.sockets.authSuccessesTotal += 1;
}

function recordSocketAuthFailure(reason) {
  state.sockets.authFailuresTotal += 1;
  pushEvent(state.sockets.authFailures, { value: 1, reason });
  addNote('warn', 'socket auth failure', { reason });
}

function recordSocketConnectionOpen(details = {}) {
  state.sockets.currentConnections += 1;
  state.sockets.totalConnections += 1;
  pushEvent(state.sockets.connections, { value: 1, ...details });
}

function recordSocketConnectionClose(details = {}) {
  state.sockets.currentConnections = Math.max(0, state.sockets.currentConnections - 1);
  state.sockets.totalDisconnections += 1;
  pushEvent(state.sockets.disconnections, { value: 1, ...details });
}

function recordChatMessage(kind, details = {}) {
  if (kind === 'room') {
    state.chat.roomMessagesTotal += 1;
    pushEvent(state.chat.roomMessages, { value: 1, ...details });
    return;
  }

  state.chat.dmMessagesTotal += 1;
  pushEvent(state.chat.dmMessages, { value: 1, ...details });
}

function recordChatError(event, details = {}) {
  state.chat.handlerErrorsTotal += 1;
  pushEvent(state.chat.handlerErrors, { value: 1, event, ...details });
  addNote('error', 'chat handler error', { event, ...details });
}

function recordVoiceJoin(details = {}) {
  state.voice.joinsTotal += 1;
  pushEvent(state.voice.joins, { value: 1, ...details });
}

function recordVoiceLeave(details = {}) {
  state.voice.leavesTotal += 1;
  pushEvent(state.voice.leaves, { value: 1, ...details });
}

function recordVoiceProduce(details = {}) {
  state.voice.producesTotal += 1;
  pushEvent(state.voice.produces, { value: 1, ...details });
}

function recordVoiceConsume(details = {}) {
  state.voice.consumesTotal += 1;
  pushEvent(state.voice.consumes, { value: 1, ...details });
}

function recordVoiceError(event, details = {}) {
  state.voice.errorsTotal += 1;
  pushEvent(state.voice.errors, { value: 1, event, ...details });
  addNote('error', 'voice handler error', { event, ...details });
}

module.exports = {
  beginHttpRequest,
  endHttpRequest,
  recordSocketAuthSuccess,
  recordSocketAuthFailure,
  recordSocketConnectionOpen,
  recordSocketConnectionClose,
  recordChatMessage,
  recordChatError,
  recordVoiceJoin,
  recordVoiceLeave,
  recordVoiceProduce,
  recordVoiceConsume,
  recordVoiceError,
  getSnapshot,
  getHealthSnapshot,
};
