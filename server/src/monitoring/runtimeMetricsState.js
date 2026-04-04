const MAX_TIMELINE_AGE_MS = 6 * 60 * 60 * 1000;
const MAX_RECENT_NOTES = 60;

function createRuntimeMetricsState() {
  return {
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
      events: [],
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
      events: [],
    },
    notes: [],
  };
}

function trimTimeline(events, now = Date.now(), { maxAgeMs = MAX_TIMELINE_AGE_MS } = {}) {
  const cutoff = now - maxAgeMs;
  while (events.length && events[0].at < cutoff) {
    events.shift();
  }
}

function pushEvent(events, payload = {}, {
  nowFn = () => Date.now(),
  trimTimelineFn = trimTimeline,
} = {}) {
  const event = { at: nowFn(), ...payload };
  events.push(event);
  trimTimelineFn(events, event.at);
  return event;
}

function addNote(state, level, message, details = null, {
  nowIsoFn = () => new Date().toISOString(),
  maxRecentNotes = MAX_RECENT_NOTES,
} = {}) {
  state.notes.unshift({
    at: nowIsoFn(),
    level,
    message,
    details,
  });
  if (state.notes.length > maxRecentNotes) {
    state.notes.length = maxRecentNotes;
  }
}

function sumEventsSince(events, windowMs, {
  nowFn = () => Date.now(),
  predicate = null,
  trimTimelineFn = trimTimeline,
} = {}) {
  const now = nowFn();
  trimTimelineFn(events, now);
  let count = 0;
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    if (event.at < now - windowMs) break;
    if (!predicate || predicate(event)) count += event.value || 1;
  }
  return count;
}

function valuesSince(events, windowMs, field, {
  nowFn = () => Date.now(),
  trimTimelineFn = trimTimeline,
} = {}) {
  const now = nowFn();
  trimTimelineFn(events, now);
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

module.exports = {
  MAX_TIMELINE_AGE_MS,
  MAX_RECENT_NOTES,
  createRuntimeMetricsState,
  trimTimeline,
  pushEvent,
  addNote,
  sumEventsSince,
  valuesSince,
};
