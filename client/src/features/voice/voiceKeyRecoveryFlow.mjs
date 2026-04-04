export async function resumeVoiceMediaAfterKeyUpdateFlow({
  channelId = null,
  refs = {},
  pendingSecureVoiceJoin = null,
  consumeProducerFn = async () => {},
  cleanupRemoteProducerFn = () => {},
  applyLiveCaptureToProducerFn = async () => null,
  scheduleVoiceHealthProbeFn = () => {},
  setMutedFn = () => {},
  updateVoiceDiagnosticsFn = () => {},
  recordLaneDiagnosticFn = () => {},
  nowIsoFn = () => new Date().toISOString(),
} = {}) {
  if (!channelId) {
    return { resumed: false, reason: 'missing-channel' };
  }

  if (refs.channelIdRef?.current !== channelId) {
    return { resumed: false, reason: 'inactive-channel' };
  }

  const hasPendingSecureVoiceJoin = Boolean(
    pendingSecureVoiceJoin && pendingSecureVoiceJoin.channelId === channelId
  );
  const forcedMutedForSecureVoice = Boolean(pendingSecureVoiceJoin?.forcedMutedForSecureVoice);

  const recoveryTargets = new Map();
  const pendingExistingProducers = Array.isArray(pendingSecureVoiceJoin?.existingProducers)
    ? pendingSecureVoiceJoin.existingProducers
    : [];
  for (const producer of pendingExistingProducers) {
    if (!producer?.producerId) continue;
    recoveryTargets.set(producer.producerId, {
      producerId: producer.producerId,
      producerUserId: producer.producerUserId ?? null,
      source: producer.source ?? null,
    });
  }

  const knownProducerEntries = Array.from(refs.producerMetaRef?.current?.entries?.() || []);
  for (const [producerId, meta] of knownProducerEntries) {
    if (!producerId) continue;
    recoveryTargets.set(producerId, {
      producerId,
      producerUserId: meta?.userId ?? null,
      source: meta?.source ?? null,
    });
  }

  let recoveredProducerCount = 0;
  let localCaptureReady = Boolean(refs.liveCaptureRef?.current && refs.producerRef?.current);

  if (forcedMutedForSecureVoice) {
    if (refs.mutedRef) {
      refs.mutedRef.current = false;
    }
    setMutedFn(false);
    try {
      refs.producerRef?.current?.resume?.();
    } catch {}
  }

  if (!hasPendingSecureVoiceJoin && recoveryTargets.size === 0 && !refs.sendTransportRef?.current) {
    return localCaptureReady
      ? {
          resumed: true,
          recoveredProducerCount,
          localCaptureReady,
          reason: 'already-ready',
        }
      : { resumed: false, reason: 'no-pending-secure-join' };
  }

  for (const { producerId, producerUserId, source } of recoveryTargets.values()) {
    if (refs.consumersRef?.current?.has?.(producerId)) {
      cleanupRemoteProducerFn(producerId, { producerUserId, source });
    }
    await consumeProducerFn(channelId, producerId, producerUserId, source);
    recoveredProducerCount += 1;
  }

  if (!localCaptureReady && refs.sendTransportRef?.current) {
    const localCapture = await applyLiveCaptureToProducerFn({
      chId: channelId,
      sendTransport: refs.sendTransportRef?.current,
    });
    localCaptureReady = Boolean(localCapture);
  }

  if (!localCaptureReady) {
    return {
      resumed: false,
      reason: 'local-capture-unavailable',
      recoveredProducerCount,
    };
  }

  if (!hasPendingSecureVoiceJoin && recoveredProducerCount === 0) {
    return {
      resumed: true,
      recoveredProducerCount,
      localCaptureReady,
      reason: 'already-ready',
    };
  }

  if (refs.voiceHealthProbeRetryCountRef) {
    refs.voiceHealthProbeRetryCountRef.current = 0;
  }
  scheduleVoiceHealthProbeFn(channelId, { reason: 'secure-key-recovery' });
  recordLaneDiagnosticFn('voice', 'secure_voice_media_resumed', {
    channelId,
    recoveredProducerCount,
  });
  updateVoiceDiagnosticsFn((previousDiagnostics) => ({
    ...previousDiagnostics,
    session: {
      ...(previousDiagnostics.session || {}),
      secureVoiceRecovery: {
        channelId,
        resumedAt: nowIsoFn(),
        recoveredProducerCount,
      },
    },
  }));

  return {
    resumed: true,
    recoveredProducerCount,
    localCaptureReady,
  };
}
