function round(value, decimals = 1) {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function isVoiceDiagnosticsEnabled() {
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    return true;
  }

  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FORCE_VOICE_DIAGNOSTICS === '1') {
    return true;
  }

  try {
    return window.electronAPI?.getAppFlavor?.() === 'staging';
  } catch {
    return false;
  }
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

function getCodecReport(reports, mediaReport) {
  if (!mediaReport?.codecId) return null;
  return reports.find((report) => report.type === 'codec' && report.id === mediaReport.codecId) || null;
}

function getTrackReport(reports, kind) {
  return reports.find((report) => (
    report.type === 'track' &&
    (report.kind === kind || report.mediaType === kind)
  )) || null;
}

function getMediaSourceReport(reports, kind) {
  return reports.find((report) => (
    report.type === 'media-source' &&
    (report.kind === kind || report.mediaType === kind)
  )) || null;
}

function getJitterBufferAverageMs(report) {
  if (!report?.jitterBufferDelay || !report?.jitterBufferEmittedCount) {
    return null;
  }

  return secondsToMs(report.jitterBufferDelay / report.jitterBufferEmittedCount);
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
  const audioTrack = getTrackReport(reports, 'audio');
  const audioMediaSource = getMediaSourceReport(reports, 'audio');
  const outboundAudioCodec = getCodecReport(reports, outbound);
  const outboundVideoCodec = getCodecReport(reports, outboundVideo);

  return pickDefined({
    outboundAudio: outbound ? pickDefined({
      packetsSent: outbound.packetsSent,
      bytesSent: outbound.bytesSent,
      retransmittedPacketsSent: outbound.retransmittedPacketsSent,
      totalPacketSendDelayMs: secondsToMs(outbound.totalPacketSendDelay),
      nackCount: outbound.nackCount,
      codecMimeType: outboundAudioCodec?.mimeType,
    }) : null,
    outboundVideo: outboundVideo ? pickDefined({
      packetsSent: outboundVideo.packetsSent,
      bytesSent: outboundVideo.bytesSent,
      retransmittedPacketsSent: outboundVideo.retransmittedPacketsSent,
      totalPacketSendDelayMs: secondsToMs(outboundVideo.totalPacketSendDelay),
      nackCount: outboundVideo.nackCount,
      firCount: outboundVideo.firCount,
      pliCount: outboundVideo.pliCount,
      framesEncoded: outboundVideo.framesEncoded,
      framesSent: outboundVideo.framesSent,
      frameWidth: outboundVideo.frameWidth,
      frameHeight: outboundVideo.frameHeight,
      framesPerSecond: round(outboundVideo.framesPerSecond, 1),
      codecMimeType: outboundVideoCodec?.mimeType,
      encoderImplementation: outboundVideo.encoderImplementation,
      powerEfficientEncoder: outboundVideo.powerEfficientEncoder,
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
    sourceAudio: (audioTrack || audioMediaSource) ? pickDefined({
      audioLevel: round(audioTrack?.audioLevel ?? audioMediaSource?.audioLevel, 3),
      totalAudioEnergy: round(audioTrack?.totalAudioEnergy ?? audioMediaSource?.totalAudioEnergy, 3),
      totalSamplesDurationMs: secondsToMs(
        audioTrack?.totalSamplesDuration ?? audioMediaSource?.totalSamplesDuration
      ),
    }) : null,
    candidatePair: candidatePair ? pickDefined({
      currentRoundTripTimeMs: secondsToMs(candidatePair.currentRoundTripTime),
      availableOutgoingBitrateBps: round(candidatePair.availableOutgoingBitrate, 0),
      availableOutgoingBitrate: round(candidatePair.availableOutgoingBitrate / 1000, 0),
    }) : null,
  });
}

export function summarizeConsumerStats(statsReport) {
  const reports = getStatsReports(statsReport);
  const inbound = getAudioReport(reports, 'inbound-rtp');
  const inboundVideo = getVideoReport(reports, 'inbound-rtp');
  const candidatePair = getSelectedCandidatePair(reports);
  const audioTrack = getTrackReport(reports, 'audio');
  const inboundAudioCodec = getCodecReport(reports, inbound);
  const inboundVideoCodec = getCodecReport(reports, inboundVideo);
  const jitterBufferAverageMs = getJitterBufferAverageMs(inbound);
  const videoJitterBufferAverageMs = getJitterBufferAverageMs(inboundVideo);

  return pickDefined({
    inboundAudio: inbound ? pickDefined({
      packetsReceived: inbound.packetsReceived,
      packetsLost: inbound.packetsLost,
      bytesReceived: inbound.bytesReceived,
      jitterMs: secondsToMs(inbound.jitter),
      jitterBufferAverageMs,
      totalAudioEnergy: round(inbound.totalAudioEnergy, 3),
      concealedSamples: inbound.concealedSamples,
      codecMimeType: inboundAudioCodec?.mimeType,
    }) : null,
    receiverAudio: audioTrack ? pickDefined({
      audioLevel: round(audioTrack.audioLevel, 3),
      totalAudioEnergy: round(audioTrack.totalAudioEnergy, 3),
      totalSamplesDurationMs: secondsToMs(audioTrack.totalSamplesDuration),
    }) : null,
    inboundVideo: inboundVideo ? pickDefined({
      packetsReceived: inboundVideo.packetsReceived,
      packetsLost: inboundVideo.packetsLost,
      bytesReceived: inboundVideo.bytesReceived,
      jitterMs: secondsToMs(inboundVideo.jitter),
      jitterBufferDelayMs: secondsToMs(inboundVideo.jitterBufferDelay),
      jitterBufferEmittedCount: inboundVideo.jitterBufferEmittedCount,
      jitterBufferAverageMs: videoJitterBufferAverageMs,
      framesReceived: inboundVideo.framesReceived,
      framesDecoded: inboundVideo.framesDecoded,
      framesDropped: inboundVideo.framesDropped,
      keyFramesDecoded: inboundVideo.keyFramesDecoded,
      frameWidth: inboundVideo.frameWidth,
      frameHeight: inboundVideo.frameHeight,
      framesPerSecond: round(inboundVideo.framesPerSecond, 1),
      totalDecodeTimeMs: secondsToMs(inboundVideo.totalDecodeTime),
      totalInterFrameDelayMs: secondsToMs(inboundVideo.totalInterFrameDelay),
      codecMimeType: inboundVideoCodec?.mimeType,
      decoderImplementation: inboundVideo.decoderImplementation,
      powerEfficientDecoder: inboundVideo.powerEfficientDecoder,
      freezeCount: inboundVideo.freezeCount,
      pauseCount: inboundVideo.pauseCount,
    }) : null,
    candidatePair: candidatePair ? pickDefined({
      currentRoundTripTimeMs: secondsToMs(candidatePair.currentRoundTripTime),
      availableIncomingBitrateBps: round(candidatePair.availableIncomingBitrate, 0),
      availableIncomingBitrate: round(candidatePair.availableIncomingBitrate / 1000, 0),
    }) : null,
  });
}

export function mergeVoiceStatsSummary(primary = null, secondary = null) {
  if (!primary) return secondary || null;
  if (!secondary) return primary || null;

  const merged = { ...primary };
  for (const [key, value] of Object.entries(secondary)) {
    if (value == null) continue;
    const existingValue = merged[key];
    if (
      existingValue
      && typeof existingValue === 'object'
      && !Array.isArray(existingValue)
      && typeof value === 'object'
      && !Array.isArray(value)
    ) {
      merged[key] = { ...existingValue, ...value };
    } else {
      merged[key] = value;
    }
  }

  return merged;
}
