function round(value, decimals = 1) {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function secondsToMs(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return round(value * 1000, 1);
}

function pickDefined(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined && value !== null)
  );
}

function getStatsReports(statsReport) {
  if (!statsReport?.values) return [];
  return Array.from(statsReport.values());
}

function getAudioReport(reports, type) {
  return reports.find((report) => (
    report.type === type && (report.kind === 'audio' || report.mediaType === 'audio')
  )) || null;
}

function getVideoReport(reports, type) {
  return reports.find((report) => (
    report.type === type && (report.kind === 'video' || report.mediaType === 'video')
  )) || null;
}

function getSelectedCandidatePair(reports) {
  return reports.find((report) => (
    report.type === 'candidate-pair' &&
    (report.selected || (report.nominated && report.state === 'succeeded'))
  )) || null;
}

export function summarizeTrackSnapshot(track) {
  if (!track) return null;

  let settings = {};
  let constraints = {};

  try {
    settings = track.getSettings?.() || {};
  } catch {}

  try {
    constraints = track.getConstraints?.() || {};
  } catch {}

  return {
    id: track.id || null,
    kind: track.kind || null,
    label: track.label || null,
    enabled: !!track.enabled,
    muted: !!track.muted,
    readyState: track.readyState || null,
    settings: pickDefined(settings),
    constraints: pickDefined(constraints),
  };
}

export function summarizeAudioContext(ctx) {
  if (!ctx) return null;

  return pickDefined({
    sampleRate: ctx.sampleRate,
    baseLatencyMs: secondsToMs(ctx.baseLatency),
    outputLatencyMs: secondsToMs(ctx.outputLatency),
    state: ctx.state,
  });
}

export function summarizeProducerStats(statsReport) {
  const reports = getStatsReports(statsReport);
  const outbound = getAudioReport(reports, 'outbound-rtp');
  const outboundVideo = getVideoReport(reports, 'outbound-rtp');
  const remoteInbound = getAudioReport(reports, 'remote-inbound-rtp');
  const remoteInboundVideo = getVideoReport(reports, 'remote-inbound-rtp');
  const candidatePair = getSelectedCandidatePair(reports);

  return pickDefined({
    outboundAudio: outbound ? pickDefined({
      packetsSent: outbound.packetsSent,
      bytesSent: outbound.bytesSent,
      retransmittedPacketsSent: outbound.retransmittedPacketsSent,
      totalPacketSendDelayMs: secondsToMs(outbound.totalPacketSendDelay),
      nackCount: outbound.nackCount,
    }) : null,
    outboundVideo: outboundVideo ? pickDefined({
      packetsSent: outboundVideo.packetsSent,
      bytesSent: outboundVideo.bytesSent,
      retransmittedPacketsSent: outboundVideo.retransmittedPacketsSent,
      totalPacketSendDelayMs: secondsToMs(outboundVideo.totalPacketSendDelay),
      nackCount: outboundVideo.nackCount,
      firCount: outboundVideo.firCount,
      pliCount: outboundVideo.pliCount,
      framesSent: outboundVideo.framesSent,
      frameWidth: outboundVideo.frameWidth,
      frameHeight: outboundVideo.frameHeight,
      framesPerSecond: round(outboundVideo.framesPerSecond, 1),
      qualityLimitationReason: outboundVideo.qualityLimitationReason,
      qualityLimitationDurations: outboundVideo.qualityLimitationDurations || null,
    }) : null,
    remoteInboundAudio: remoteInbound ? pickDefined({
      packetsLost: remoteInbound.packetsLost,
      jitterMs: secondsToMs(remoteInbound.jitter),
      roundTripTimeMs: secondsToMs(remoteInbound.roundTripTime),
      totalRoundTripTimeMs: secondsToMs(remoteInbound.totalRoundTripTime),
      fractionLost: round(remoteInbound.fractionLost, 4),
    }) : null,
    remoteInboundVideo: remoteInboundVideo ? pickDefined({
      packetsLost: remoteInboundVideo.packetsLost,
      jitterMs: secondsToMs(remoteInboundVideo.jitter),
      roundTripTimeMs: secondsToMs(remoteInboundVideo.roundTripTime),
      totalRoundTripTimeMs: secondsToMs(remoteInboundVideo.totalRoundTripTime),
      fractionLost: round(remoteInboundVideo.fractionLost, 4),
    }) : null,
    candidatePair: candidatePair ? pickDefined({
      currentRoundTripTimeMs: secondsToMs(candidatePair.currentRoundTripTime),
      availableOutgoingBitrate: round(candidatePair.availableOutgoingBitrate, 0),
    }) : null,
  });
}

export function summarizeConsumerStats(statsReport) {
  const reports = getStatsReports(statsReport);
  const inbound = getAudioReport(reports, 'inbound-rtp');
  const candidatePair = getSelectedCandidatePair(reports);

  const jitterBufferAverageMs = (
    inbound?.jitterBufferDelay &&
    inbound?.jitterBufferEmittedCount
  )
    ? secondsToMs(inbound.jitterBufferDelay / inbound.jitterBufferEmittedCount)
    : null;

  return pickDefined({
    inboundAudio: inbound ? pickDefined({
      packetsReceived: inbound.packetsReceived,
      packetsLost: inbound.packetsLost,
      bytesReceived: inbound.bytesReceived,
      jitterMs: secondsToMs(inbound.jitter),
      jitterBufferAverageMs,
      totalAudioEnergy: round(inbound.totalAudioEnergy, 3),
      concealedSamples: inbound.concealedSamples,
    }) : null,
    candidatePair: candidatePair ? pickDefined({
      currentRoundTripTimeMs: secondsToMs(candidatePair.currentRoundTripTime),
      availableIncomingBitrate: round(candidatePair.availableIncomingBitrate, 0),
    }) : null,
  });
}
