const MAX_LANE_DIAGNOSTICS = 250;
export const LANE_DIAGNOSTIC_EVENT_NAME = 'guild:lane-diagnostic';

function canUseDom() {
  return typeof window !== 'undefined';
}

function getStore() {
  if (!canUseDom()) return [];
  if (!Array.isArray(window.__guildLaneDiagnosticsBuffer)) {
    window.__guildLaneDiagnosticsBuffer = [];
    window.__guildLaneDiagnostics = {
      read() {
        return [...window.__guildLaneDiagnosticsBuffer];
      },
      clear() {
        window.__guildLaneDiagnosticsBuffer.length = 0;
      },
    };
  }
  return window.__guildLaneDiagnosticsBuffer;
}

function sanitizeValue(value, depth = 0) {
  if (depth > 3) return '[max-depth]';
  if (value == null) return value;
  if (typeof value === 'string') return value.slice(0, 400);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((entry) => sanitizeValue(entry, depth + 1));
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 30)
        .map(([key, entry]) => [key, sanitizeValue(entry, depth + 1)])
    );
  }
  return String(value);
}

export function isLaneDiagnosticsEnabled(lane = '') {
  if (!canUseDom()) return false;
  try {
    const globalFlag = localStorage.getItem('guild:diagnostics') === 'true';
    const laneFlag = lane ? localStorage.getItem(`guild:diagnostics:${lane}`) === 'true' : false;
    return globalFlag || laneFlag;
  } catch {
    return false;
  }
}

export function recordLaneDiagnostic(lane, event, details = {}) {
  if (!canUseDom() || !lane || !event) return null;

  const entry = {
    at: new Date().toISOString(),
    lane,
    event,
    details: sanitizeValue(details),
  };

  const store = getStore();
  store.push(entry);
  if (store.length > MAX_LANE_DIAGNOSTICS) {
    store.splice(0, store.length - MAX_LANE_DIAGNOSTICS);
  }

  try {
    window.dispatchEvent(new CustomEvent(LANE_DIAGNOSTIC_EVENT_NAME, { detail: entry }));
  } catch {}

  if (isLaneDiagnosticsEnabled(lane)) {
    try {
      console.debug(`[lane:${lane}] ${event}`, entry.details);
    } catch {}
  }

  return entry;
}

export function getLaneDiagnostics() {
  return [...getStore()];
}

export function clearLaneDiagnostics() {
  const store = getStore();
  store.length = 0;
}
