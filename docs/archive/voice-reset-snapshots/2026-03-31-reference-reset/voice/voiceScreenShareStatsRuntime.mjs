export function startVoiceScreenShareStatsRuntime({
  refs,
  setScreenShareDiagnosticsFn = () => {},
  maybeAdaptScreenShareProfileFn = async () => {},
  summarizeProducerStatsFn = (stats) => stats,
  summarizeTrackSnapshotFn = (track) => track,
  summarizeScreenShareProfileFn = (profile) => profile,
  summarizeScreenShareHardwareFn = () => ({}),
  screenShareProfiles = [],
  roundRateFn = (value) => value,
  performanceNowFn = () => performance.now(),
  nowIsoFn = () => new Date().toISOString(),
  setIntervalFn = (callback, intervalMs) => setInterval(callback, intervalMs),
  clearIntervalFn = (intervalId) => clearInterval(intervalId),
} = {}) {
  const {
    screenShareProducerRef,
    screenShareStreamRef,
    screenShareStatsRef,
    screenShareProfileIndexRef,
    screenShareSimulcastEnabledRef,
    screenShareAdaptationRef,
  } = refs || {};
  let cancelled = false;

  const pollScreenShareStats = async () => {
    const producer = screenShareProducerRef?.current || null;
    const track = screenShareStreamRef?.current?.getVideoTracks?.()?.[0] || null;
    if (!producer || !track) return;

    let senderStats = null;
    try {
      senderStats = summarizeProducerStatsFn(await producer.getStats());
    } catch {}

    if (cancelled) return;

    const sampledAt = nowIsoFn();
    const captureTrackSnapshot = summarizeTrackSnapshotFn(track);
    const currentBytes = senderStats?.outboundVideo?.bytesSent ?? null;
    const previousSample = screenShareStatsRef?.current || null;
    let outgoingBitrateKbps = null;

    if (
      previousSample
      && currentBytes !== null
      && previousSample.bytesSent !== null
      && typeof previousSample.timestamp === 'number'
    ) {
      const elapsedMs = performanceNowFn() - previousSample.timestamp;
      if (elapsedMs > 0) {
        outgoingBitrateKbps = roundRateFn(Math.max(0, ((currentBytes - previousSample.bytesSent) * 8) / elapsedMs), 1);
      }
    }

    if (screenShareStatsRef) {
      screenShareStatsRef.current = {
        timestamp: performanceNowFn(),
        bytesSent: currentBytes,
      };
    }

    await maybeAdaptScreenShareProfileFn(senderStats);

    setScreenShareDiagnosticsFn((prev) => ({
      active: true,
      startedAt: prev?.startedAt || sampledAt,
      requestedCapture: prev?.requestedCapture || null,
      sourceId: prev?.sourceId || null,
      includeAudio: prev?.includeAudio ?? false,
      selectedCodecMode: prev?.selectedCodecMode || null,
      requestedCodec: prev?.requestedCodec || null,
      selectedCodec: prev?.selectedCodec || null,
      e2eeMode: prev?.e2eeMode || 'encrypted',
      requestedContentHint: prev?.requestedContentHint || null,
      senderParameters: prev?.senderParameters || null,
      activeProfile: prev?.activeProfile || summarizeScreenShareProfileFn(
        screenShareProfiles[screenShareProfileIndexRef?.current ?? 0],
      ),
      producerMode: prev?.producerMode || (
        screenShareSimulcastEnabledRef?.current ? 'simulcast' : 'single'
      ),
      promotionFailure: prev?.promotionFailure || null,
      adaptation: {
        hardware: prev?.adaptation?.hardware || summarizeScreenShareHardwareFn(),
        lastReason: screenShareAdaptationRef?.current?.lastReason || prev?.adaptation?.lastReason || 'initial',
        lastChangedAt: prev?.adaptation?.lastChangedAt || null,
        degradeSamples: screenShareAdaptationRef?.current?.degradeSamples ?? 0,
        recoverySamples: screenShareAdaptationRef?.current?.recoverySamples ?? 0,
      },
      captureTrack: captureTrackSnapshot,
      sender: senderStats ? {
        ...senderStats,
        outgoingBitrateKbps,
      } : null,
      sampledAt,
    }));
  };

  void pollScreenShareStats();
  const intervalId = setIntervalFn(() => {
    void pollScreenShareStats();
  }, 1500);

  return () => {
    cancelled = true;
    clearIntervalFn(intervalId);
  };
}
