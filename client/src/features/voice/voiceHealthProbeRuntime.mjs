import { mergeVoiceStatsSummary } from '../../utils/voiceDiagnostics.js';

export async function runVoiceHealthProbeCheck({
  chId = null,
  reason = 'join',
  currentChannelId = null,
  muted = false,
  producer = null,
  retryCountRef = { current: 0 },
  summarizeProducerStatsFn = (stats) => stats,
  updateVoiceDiagnosticsFn = () => {},
  reconfigureLiveCaptureFn = async () => {},
  warnFn = () => {},
  nowIsoFn = () => new Date().toISOString(),
  debugLogFn = globalThis.window?.electronAPI?.debugLog?.bind?.(globalThis.window?.electronAPI) || null,
} = {}) {
  if (!chId || currentChannelId !== chId || muted || !producer) {
    return {
      shouldReschedule: false,
      reconfigured: false,
      stats: null,
    };
  }

  let stats = null;
  try {
    stats = summarizeProducerStatsFn(await producer.getStats());
  } catch {}

  if (producer?.rtpSender?.getStats) {
    try {
      const senderStats = summarizeProducerStatsFn(await producer.rtpSender.getStats());
      stats = mergeVoiceStatsSummary(stats, senderStats);
    } catch {}
  }

  const packetsSent = stats?.outboundAudio?.packetsSent ?? 0;
  const bytesSent = stats?.outboundAudio?.bytesSent ?? 0;
  const sampledAt = nowIsoFn();
  const producerTrack = producer?.track || producer?.rtpSender?.track || null;

  try {
    debugLogFn?.('voice-health', JSON.stringify({
      at: sampledAt,
      channelId: chId,
      reason,
      retryCount: retryCountRef?.current ?? 0,
      packetsSent,
      bytesSent,
      stats,
      track: producerTrack
        ? {
            id: producerTrack.id || null,
            enabled: producerTrack.enabled ?? null,
            muted: producerTrack.muted ?? null,
            readyState: producerTrack.readyState || null,
            label: producerTrack.label || null,
          }
        : null,
    }));
  } catch {}

  updateVoiceDiagnosticsFn((prev) => ({
    ...prev,
    senderStats: stats
      ? {
          ...stats,
          sampledAt,
        }
      : prev?.senderStats || null,
  }));

  if (packetsSent > 0 || bytesSent > 0) {
    retryCountRef.current = 0;
    return {
      shouldReschedule: false,
      reconfigured: false,
      stats,
    };
  }

  if (retryCountRef.current >= 1) {
    warnFn('[Voice] Outbound audio health probe still shows no packets after retry.', {
      channelId: chId,
      reason,
    });
    return {
      shouldReschedule: false,
      reconfigured: false,
      stats,
    };
  }

  retryCountRef.current += 1;
  warnFn('[Voice] Outbound audio health probe found no packets, rebuilding live capture once.', {
    channelId: chId,
    reason,
  });

  await reconfigureLiveCaptureFn();

  return {
    shouldReschedule: true,
    reconfigured: true,
    stats,
  };
}
