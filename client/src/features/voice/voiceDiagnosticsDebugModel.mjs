function pickAudioDirection(stats = null, direction = null) {
  const bucket = stats?.[direction] || null;
  if (!bucket) return null;

  return {
    packets: bucket.packetsSent ?? bucket.packetsReceived ?? null,
    bytes: bucket.bytesSent ?? bucket.bytesReceived ?? null,
    totalAudioEnergy: bucket.totalAudioEnergy ?? null,
    jitterMs: bucket.jitterMs ?? null,
    codecMimeType: bucket.codecMimeType ?? null,
  };
}

function summarizeConsumerEntry(consumerDiagnostics = null) {
  if (!consumerDiagnostics) return null;

  return {
    userId: consumerDiagnostics.producerUserId || null,
    source: consumerDiagnostics.producerSource || null,
    playbackState: consumerDiagnostics.playback?.state || null,
    playbackError: consumerDiagnostics.playback?.error || null,
    inboundAudio: pickAudioDirection(consumerDiagnostics.stats, 'inboundAudio'),
  };
}

export function buildVoiceDiagnosticsDebugPayload({
  channelId = null,
  joinError = null,
  liveVoiceFallbackReason = null,
  voiceDiagnostics = null,
} = {}) {
  if (!channelId || !voiceDiagnostics?.updatedAt) {
    return null;
  }

  const consumers = Object.fromEntries(
    Object.entries(voiceDiagnostics.consumers || {})
      .map(([producerId, consumerDiagnostics]) => [
        producerId,
        summarizeConsumerEntry(consumerDiagnostics),
      ])
      .filter(([, value]) => Boolean(value))
  );

  return {
    at: new Date().toISOString(),
    channelId,
    updatedAt: voiceDiagnostics.updatedAt || null,
    joinError: joinError || null,
    liveVoiceFallbackReason: liveVoiceFallbackReason || null,
    outputTrackMode: voiceDiagnostics.liveCapture?.outputTrackMode || null,
    captureBackend: voiceDiagnostics.liveCapture?.filter?.backend || null,
    captureFallbackReason: voiceDiagnostics.liveCapture?.filter?.fallbackReason || null,
    sender: {
      outboundAudio: pickAudioDirection(voiceDiagnostics.senderStats, 'outboundAudio'),
      remoteInboundAudio: pickAudioDirection(voiceDiagnostics.senderStats, 'remoteInboundAudio'),
    },
    consumers,
  };
}
