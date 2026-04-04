function buildTrafficSnapshot({
  state,
  sumEventsSinceFn,
  valuesSinceFn,
  averageFn,
  percentileFn,
  buildSeriesFn,
  safePctFn,
}) {
  const httpRequestsLast1m = sumEventsSinceFn(state.http.requests, 60_000);
  const httpRequestsLast5m = sumEventsSinceFn(state.http.requests, 5 * 60_000);
  const httpErrorsLast5m = sumEventsSinceFn(state.http.errors, 5 * 60_000);
  const httpLatenciesLast5m = valuesSinceFn(state.http.latencies, 5 * 60_000, 'ms');

  return {
    http: {
      inflight: state.http.inflight,
      total: state.http.total,
      requestsLast1m: httpRequestsLast1m,
      requestsLast5m: httpRequestsLast5m,
      errorsLast5m: httpErrorsLast5m,
      errorRateLast5m: safePctFn(httpErrorsLast5m, httpRequestsLast5m),
      avgLatencyMsLast5m: averageFn(httpLatenciesLast5m),
      p95LatencyMsLast5m: percentileFn(httpLatenciesLast5m, 95),
      statusClasses: state.http.statusClasses,
      series: {
        requestsPerMinute: buildSeriesFn(state.http.requests),
        errorsPerMinute: buildSeriesFn(state.http.errors),
      },
    },
    sockets: {
      currentConnections: state.sockets.currentConnections,
      totalConnections: state.sockets.totalConnections,
      totalDisconnections: state.sockets.totalDisconnections,
      authSuccessesTotal: state.sockets.authSuccessesTotal,
      authFailuresTotal: state.sockets.authFailuresTotal,
      connectionsLast5m: sumEventsSinceFn(state.sockets.connections, 5 * 60_000),
      disconnectionsLast5m: sumEventsSinceFn(state.sockets.disconnections, 5 * 60_000),
      authFailuresLast5m: sumEventsSinceFn(state.sockets.authFailures, 5 * 60_000),
      series: {
        connectionsPerMinute: buildSeriesFn(state.sockets.connections),
        authFailuresPerMinute: buildSeriesFn(state.sockets.authFailures),
      },
    },
    chat: {
      roomMessagesTotal: state.chat.roomMessagesTotal,
      dmMessagesTotal: state.chat.dmMessagesTotal,
      handlerErrorsTotal: state.chat.handlerErrorsTotal,
      roomMessagesLast1h: sumEventsSinceFn(state.chat.roomMessages, 60 * 60_000),
      dmMessagesLast1h: sumEventsSinceFn(state.chat.dmMessages, 60 * 60_000),
      recentEvents: state.chat.events.slice(-20),
      series: {
        roomMessagesPerMinute: buildSeriesFn(state.chat.roomMessages),
        dmMessagesPerMinute: buildSeriesFn(state.chat.dmMessages),
      },
    },
    voice: {
      joinsTotal: state.voice.joinsTotal,
      leavesTotal: state.voice.leavesTotal,
      producesTotal: state.voice.producesTotal,
      consumesTotal: state.voice.consumesTotal,
      errorsTotal: state.voice.errorsTotal,
      joinsLast1h: sumEventsSinceFn(state.voice.joins, 60 * 60_000),
      leavesLast1h: sumEventsSinceFn(state.voice.leaves, 60 * 60_000),
      errorsLast5m: sumEventsSinceFn(state.voice.errors, 5 * 60_000),
      recentEvents: state.voice.events.slice(-20),
      series: {
        joinsPerMinute: buildSeriesFn(state.voice.joins),
        producesPerMinute: buildSeriesFn(state.voice.produces),
        errorsPerMinute: buildSeriesFn(state.voice.errors),
      },
    },
  };
}

function deriveOverallStatus(checks, severityFn) {
  return checks.reduce((current, check) => (
    severityFn(check.status) > severityFn(current) ? check.status : current
  ), 'ok');
}

function buildHealthSnapshotSummary(snapshot) {
  return {
    onlineUsers: snapshot.application.onlineUsers || 0,
    activeSockets: snapshot.traffic.sockets.currentConnections,
    requestsLast1m: snapshot.traffic.http.requestsLast1m,
    p95LatencyMsLast5m: snapshot.traffic.http.p95LatencyMsLast5m,
    activeVoiceChannels: snapshot.application.voice?.activeChannels || 0,
    voiceWorkerCount: snapshot.application.mediasoup?.workerCount || 0,
    voiceWorkerTarget: snapshot.application.mediasoup?.targetWorkerCount || 0,
    voiceWorkersAvailable: snapshot.application.mediasoup?.workersAvailable !== false,
    voiceDegraded: !!snapshot.application.mediasoup?.degraded,
    voiceRecoveryPending: !!snapshot.application.mediasoup?.recoveryPending,
    voiceErrorsLast5m: snapshot.traffic.voice?.errorsLast5m || 0,
  };
}

module.exports = {
  buildTrafficSnapshot,
  deriveOverallStatus,
  buildHealthSnapshotSummary,
};
