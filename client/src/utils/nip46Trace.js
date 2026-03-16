const TRACE_STORAGE_KEY = 'guild_nip46_trace_v1';
const TRACE_EVENT_NAME = 'guild-nip46-trace-updated';
const MAX_TRACE_ENTRIES = 200;

let traceBuffer = null;

function sanitizeString(value) {
  if (typeof value !== 'string') return value;

  if (value.startsWith('nsec1')) {
    return `${value.slice(0, 10)}...[redacted]`;
  }

  if (value.includes('secret=')) {
    return value.replace(/secret=([^&]+)/gi, 'secret=[redacted]');
  }

  if (value.includes('?iv=')) {
    return `nip04_ciphertext(${value.length} chars)`;
  }

  if (/^[0-9a-f]{64,}$/i.test(value)) {
    return redactTraceValue(value);
  }

  if (value.length > 180) {
    return `${value.slice(0, 180)}... (${value.length} chars)`;
  }

  return value;
}

function sanitizeValue(value, seen = new WeakSet()) {
  if (value == null) return value;
  if (typeof value === 'string') return sanitizeString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Error) return summarizeError(value);
  if (Array.isArray(value)) return value.map(item => sanitizeValue(item, seen));

  if (typeof value === 'object') {
    if (seen.has(value)) return '[Circular]';
    seen.add(value);

    const out = {};
    for (const [key, inner] of Object.entries(value)) {
      if (typeof inner === 'undefined') continue;
      out[key] = sanitizeValue(inner, seen);
    }
    return out;
  }

  return String(value);
}

function loadTraceBuffer() {
  if (traceBuffer) return traceBuffer;
  if (typeof window === 'undefined' || !window.localStorage) {
    traceBuffer = [];
    return traceBuffer;
  }

  try {
    const raw = window.localStorage.getItem(TRACE_STORAGE_KEY);
    traceBuffer = raw ? JSON.parse(raw) : [];
  } catch {
    traceBuffer = [];
  }

  return traceBuffer;
}

function persistTraceBuffer() {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage?.setItem(TRACE_STORAGE_KEY, JSON.stringify(loadTraceBuffer()));
  } catch {}

  window.dispatchEvent(new CustomEvent(TRACE_EVENT_NAME, {
    detail: { count: loadTraceBuffer().length },
  }));
}

function consoleMethod(level) {
  if (level === 'error') return console.error;
  if (level === 'warn') return console.warn;
  return console.log;
}

export function redactTraceValue(value, start = 8, end = 6) {
  if (typeof value !== 'string' || value.length <= start + end) return value;
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

export function summarizeError(error) {
  if (!error) return null;
  if (typeof error === 'string') return sanitizeString(error);

  const aggregateErrors = Array.isArray(error.errors)
    ? error.errors.map((inner) => summarizeError(inner))
    : undefined;

  return sanitizeValue({
    name: error.name || 'Error',
    message: error.message || String(error),
    errors: aggregateErrors,
  });
}

export function summarizeNostrEvent(event) {
  if (!event || typeof event !== 'object') return sanitizeValue(event);

  return sanitizeValue({
    kind: event.kind,
    created_at: event.created_at,
    content: event.content,
    tags: Array.isArray(event.tags) ? event.tags : [],
    pubkey: event.pubkey,
    id: event.id,
    sig: event.sig,
  });
}

export function pushNip46Trace(step, details = {}, level = 'info') {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    step,
    details: sanitizeValue(details),
  };

  const buffer = loadTraceBuffer();
  buffer.push(entry);
  if (buffer.length > MAX_TRACE_ENTRIES) {
    buffer.splice(0, buffer.length - MAX_TRACE_ENTRIES);
  }

  persistTraceBuffer();

  try {
    consoleMethod(level)(`[NIP-46 trace] ${step}`, entry.details);
  } catch {}

  return entry;
}

export function clearNip46Trace(reason = 'manual_clear') {
  traceBuffer = [];
  persistTraceBuffer();
  pushNip46Trace('trace.cleared', { reason });
}

export function getNip46Trace() {
  return [...loadTraceBuffer()];
}

export function formatNip46Trace() {
  return JSON.stringify({
    generatedAt: new Date().toISOString(),
    entries: getNip46Trace(),
  }, null, 2);
}

export function getNip46TraceEventName() {
  return TRACE_EVENT_NAME;
}
