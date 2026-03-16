const PERF_SAMPLE_LIMIT = 200;

let perfSequence = 0;
const activePerfTraces = new Map();

function roundMs(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return Math.round(value * 10) / 10;
}

function sanitizeRecord(record) {
  return Object.fromEntries(
    Object.entries(record || {}).filter(([, value]) => value !== undefined)
  );
}

function isPerfEnabled() {
  try {
    return Boolean(import.meta?.env?.DEV);
  } catch {
    return false;
  }
}

function getPerfStore() {
  if (typeof window === 'undefined') {
    return { samples: [] };
  }

  if (!window.__guildPerfStore) {
    window.__guildPerfStore = { samples: [] };
  }

  return window.__guildPerfStore;
}

function recordPerfSample(sample) {
  if (!isPerfEnabled() || !sample) return sample;

  const store = getPerfStore();
  store.samples.push(sample);
  if (store.samples.length > PERF_SAMPLE_LIMIT) {
    store.samples.splice(0, store.samples.length - PERF_SAMPLE_LIMIT);
  }

  window.dispatchEvent(new CustomEvent('guild:perf-sample', {
    detail: sample,
  }));

  if (window.electronAPI?.logPerfSample) {
    window.electronAPI.logPerfSample(sample);
  } else {
    console.info('[Perf]', sample);
  }

  return sample;
}

export function startPerfTrace(name, meta = {}) {
  if (!isPerfEnabled()) return null;

  const id = `${name}:${Date.now()}:${++perfSequence}`;
  activePerfTraces.set(id, {
    id,
    name,
    meta: sanitizeRecord(meta),
    phases: [],
    startedAtIso: new Date().toISOString(),
    startedAtMs: performance.now(),
  });
  return id;
}

export function addPerfPhase(traceId, phase, meta = {}) {
  if (!isPerfEnabled() || !traceId) return;

  const trace = activePerfTraces.get(traceId);
  if (!trace) return;

  trace.phases.push(sanitizeRecord({
    phase,
    atMs: roundMs(performance.now() - trace.startedAtMs),
    ...meta,
  }));
}

export function endPerfTrace(traceId, meta = {}) {
  if (!isPerfEnabled() || !traceId) return null;

  const trace = activePerfTraces.get(traceId);
  if (!trace) return null;
  activePerfTraces.delete(traceId);

  return recordPerfSample(sanitizeRecord({
    id: trace.id,
    name: trace.name,
    startedAt: trace.startedAtIso,
    endedAt: new Date().toISOString(),
    durationMs: roundMs(performance.now() - trace.startedAtMs),
    meta: trace.meta,
    phases: trace.phases,
    ...meta,
  }));
}

export function cancelPerfTrace(traceId, meta = {}) {
  return endPerfTrace(traceId, {
    status: 'cancelled',
    ...meta,
  });
}

export function endPerfTraceAfterNextPaint(traceId, meta = {}) {
  if (!isPerfEnabled() || !traceId) return;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      addPerfPhase(traceId, 'paint');
      endPerfTrace(traceId, meta);
    });
  });
}

export function getPerfSamples() {
  return [...getPerfStore().samples];
}
