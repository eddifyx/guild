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

  const packetsSent = stats?.outboundAudio?.packetsSent ?? 0;
  const bytesSent = stats?.outboundAudio?.bytesSent ?? 0;
  const sampledAt = nowIsoFn();

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
