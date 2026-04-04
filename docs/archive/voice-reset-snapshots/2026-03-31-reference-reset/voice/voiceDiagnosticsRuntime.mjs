export function startVoiceDiagnosticsStatsRuntime({
  refs,
  summarizeProducerStatsFn = (stats) => stats,
  summarizeConsumerStatsFn = (stats) => stats,
  updateVoiceDiagnosticsFn = () => {},
  nowIsoFn = () => new Date().toISOString(),
  setIntervalFn = (callback, intervalMs) => setInterval(callback, intervalMs),
  clearIntervalFn = (intervalId) => clearInterval(intervalId),
} = {}) {
  const { producerRef, consumersRef } = refs || {};
  let cancelled = false;

  const pollStats = async () => {
    const producer = producerRef?.current || null;
    let nextSenderStats = null;

    if (producer) {
      try {
        nextSenderStats = summarizeProducerStatsFn(await producer.getStats());
      } catch {}
    }

    const consumerEntries = Array.from(consumersRef?.current?.entries?.() || []);
    const consumerStatsEntries = await Promise.all(consumerEntries.map(async ([producerId, consumer]) => {
      try {
        const stats = summarizeConsumerStatsFn(await consumer.getStats());
        return [producerId, stats];
      } catch {
        return null;
      }
    }));

    if (cancelled) return;

    updateVoiceDiagnosticsFn((prev) => {
      const nextConsumers = { ...(prev?.consumers || {}) };
      const sampledAt = nowIsoFn();

      for (const entry of consumerStatsEntries) {
        if (!entry) continue;
        const [producerId, stats] = entry;
        nextConsumers[producerId] = {
          ...nextConsumers[producerId],
          stats,
          sampledAt,
        };
      }

      return {
        ...prev,
        senderStats: nextSenderStats
          ? {
              ...nextSenderStats,
              sampledAt,
            }
          : null,
        consumers: nextConsumers,
      };
    });
  };

  void pollStats();
  const intervalId = setIntervalFn(() => {
    void pollStats();
  }, 2000);

  return () => {
    cancelled = true;
    clearIntervalFn(intervalId);
  };
}

export function startVoiceConsumerQualityRuntime({
  channelId = null,
  socket = null,
  refs,
  summarizeConsumerStatsFn = (stats) => stats,
  getBitrateBpsFn = (primary, secondary) => primary ?? secondary ?? null,
  setIntervalFn = (callback, intervalMs) => setInterval(callback, intervalMs),
  clearIntervalFn = (intervalId) => clearInterval(intervalId),
} = {}) {
  const { consumersRef, producerMetaRef } = refs || {};
  let cancelled = false;

  const emitConsumerQuality = async () => {
    const consumerEntries = Array.from(consumersRef?.current?.entries?.() || []).filter(([producerId]) => (
      producerMetaRef?.current?.get?.(producerId)?.source === 'screen-video'
    ));

    if (consumerEntries.length === 0) return;

    await Promise.all(consumerEntries.map(async ([producerId, consumer]) => {
      try {
        const stats = summarizeConsumerStatsFn(await consumer.getStats());
        if (cancelled) return;

        const inboundVideo = stats?.inboundVideo || null;
        const candidatePair = stats?.candidatePair || null;
        socket?.emit?.('voice:consumer-quality', {
          channelId,
          producerId,
          availableIncomingBitrate: getBitrateBpsFn(
            candidatePair?.availableIncomingBitrate,
            candidatePair?.availableIncomingBitrateBps,
          ),
          framesPerSecond: inboundVideo?.framesPerSecond ?? null,
          jitterBufferDelayMs: inboundVideo?.jitterBufferAverageMs ?? inboundVideo?.jitterBufferDelayMs ?? null,
          freezeCount: inboundVideo?.freezeCount ?? null,
          pauseCount: inboundVideo?.pauseCount ?? null,
        });
      } catch {}
    }));
  };

  void emitConsumerQuality();
  const intervalId = setIntervalFn(() => {
    void emitConsumerQuality();
  }, 1500);

  return () => {
    cancelled = true;
    clearIntervalFn(intervalId);
  };
}
