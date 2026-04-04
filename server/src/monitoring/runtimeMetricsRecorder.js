function createRuntimeMetricsRecorder({
  state,
  addNote,
  pushEvent,
  classifyStatus,
  normalizeUrl,
} = {}) {
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
      addNote(state, 'error', 'server returned 5xx', {
        method,
        url: normalizeUrl(url),
        statusCode,
        durationMs: Math.round(durationMs),
      });
    } else if (durationMs >= 1500) {
      addNote(state, 'warn', 'slow http request', {
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
    addNote(state, 'warn', 'socket auth failure', { reason });
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
    if (kind === 'room' || kind === 'guildchat') {
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
    addNote(state, 'error', 'chat handler error', { event, ...details });
  }

  function recordChatEvent(event, details = {}) {
    pushEvent(state.chat.events, { value: 1, event, ...details });
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
    addNote(state, 'error', 'voice handler error', { event, ...details });
  }

  function recordVoiceEvent(event, details = {}) {
    pushEvent(state.voice.events, { value: 1, event, ...details });
  }

  return {
    beginHttpRequest,
    endHttpRequest,
    recordSocketAuthSuccess,
    recordSocketAuthFailure,
    recordSocketConnectionOpen,
    recordSocketConnectionClose,
    recordChatMessage,
    recordChatError,
    recordChatEvent,
    recordVoiceJoin,
    recordVoiceLeave,
    recordVoiceProduce,
    recordVoiceConsume,
    recordVoiceError,
    recordVoiceEvent,
  };
}

module.exports = {
  createRuntimeMetricsRecorder,
};
