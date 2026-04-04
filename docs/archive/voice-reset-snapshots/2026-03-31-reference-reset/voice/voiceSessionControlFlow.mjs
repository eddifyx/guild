import { runVoiceJoinFlow } from './voiceJoinFlow.mjs';

export async function runVoiceJoinRequest({
  chId = null,
  skipConnectChime = false,
  socket = null,
  refs = {},
  setJoinErrorFn = () => {},
  setE2EWarningFn = () => {},
  setLiveVoiceFallbackReasonFn = () => {},
  recordLaneDiagnosticFn = () => {},
  runVoiceJoinFlowFn = runVoiceJoinFlow,
  ensureSecureMediaReadyFn = () => {},
  resetVoiceSessionFn = async () => {},
  emitAsyncFn = async () => ({}),
  rememberUsersFn = () => {},
  getUntrustedVoiceParticipantsFn = () => [],
  buildVoiceTrustErrorFn = () => 'Voice trust check failed.',
  deviceCtor,
  setDeviceFn = () => {},
  createSendTransportFn = async () => null,
  createRecvTransportFn = async () => null,
  setChannelIdFn = () => {},
  setDeafenedFn = () => {},
  setVoiceChannelIdFn = () => {},
  syncVoiceParticipantsFn = async () => {},
  getVoiceParticipantIdsFn = () => [],
  updateVoiceDiagnosticsFn = () => {},
  consumeProducerFn = async () => {},
  syncVoiceE2EStateFn = () => {},
  playConnectChimeFn = () => {},
  getPlatformFn = () => null,
  prefetchDesktopSourcesFn = () => {},
  applyLiveCaptureToProducerFn = async () => null,
  setMutedFn = () => {},
  clearVoiceHealthProbeFn = () => {},
  scheduleVoiceHealthProbeFn = () => {},
  isExpectedVoiceTeardownErrorFn = () => false,
  normalizeVoiceErrorMessageFn = (error) => error?.message || '',
  scheduleClearJoinErrorFn = (callback, delayMs) => globalThis.setTimeout?.(callback, delayMs),
  logErrorFn = () => {},
} = {}) {
  if (!socket) return null;

  const joinGen = ++refs.joinGenRef.current;
  setJoinErrorFn(null);
  setE2EWarningFn(null);
  setLiveVoiceFallbackReasonFn(null);
  recordLaneDiagnosticFn('voice', 'join_requested', {
    channelId: chId,
  });

  try {
    const joinResult = await runVoiceJoinFlowFn({
      chId,
      skipConnectChime,
      joinGen,
      getCurrentJoinGenFn: () => refs.joinGenRef.current,
      currentChannelId: refs.channelIdRef.current,
      ensureSecureMediaReadyFn,
      resetVoiceSessionFn,
      emitAsyncFn,
      recordLaneDiagnosticFn,
      rememberUsersFn,
      getUntrustedVoiceParticipantsFn,
      buildVoiceTrustErrorFn,
      deviceCtor,
      setDeviceFn,
      createSendTransportFn,
      createRecvTransportFn,
      setChannelIdFn,
      setDeafenedFn,
      setVoiceChannelIdFn,
      setE2EWarningFn,
      syncVoiceParticipantsFn,
      getVoiceParticipantIdsFn,
      updateVoiceDiagnosticsFn,
      consumeProducerFn,
      syncVoiceE2EStateFn,
      playConnectChimeFn,
      getPlatformFn,
      prefetchDesktopSourcesFn,
      applyLiveCaptureToProducerFn,
      setMutedFn,
      clearVoiceHealthProbeFn,
      voiceHealthProbeRetryCountRef: refs.voiceHealthProbeRetryCountRef,
      scheduleVoiceHealthProbeFn,
    });
    if (joinResult?.aborted) {
      return joinResult;
    }
    return joinResult;
  } catch (err) {
    logErrorFn('joinChannel failed:', err);
    if (joinGen !== refs.joinGenRef.current || isExpectedVoiceTeardownErrorFn(err)) {
      return {
        aborted: true,
        phase: 'stale-error',
      };
    }

    const message = normalizeVoiceErrorMessageFn(err) || 'Failed to join voice channel';
    recordLaneDiagnosticFn('voice', 'join_failed', {
      channelId: chId,
      error: message,
    });
    await resetVoiceSessionFn({ channelId: chId, notifyServer: true });
    setJoinErrorFn(message);
    setE2EWarningFn(message);
    scheduleClearJoinErrorFn(() => setJoinErrorFn(null), 5000);
    return {
      aborted: false,
      ready: false,
      error: message,
    };
  }
}

export async function leaveVoiceChannelSession({
  refs = {},
  setJoinErrorFn = () => {},
  resetVoiceSessionFn = async () => {},
  playLeaveChimeFn = () => {},
  clearTimeoutFn = globalThis.clearTimeout,
  cancelPerfTraceFn = () => {},
} = {}) {
  if (refs.pendingLiveReconfigureRef?.current) {
    clearTimeoutFn(refs.pendingLiveReconfigureRef.current);
    refs.pendingLiveReconfigureRef.current = null;
  }
  if (refs.pendingVoiceModeSwitchTraceRef?.current) {
    cancelPerfTraceFn(refs.pendingVoiceModeSwitchTraceRef.current, {
      reason: 'left-channel',
    });
    refs.pendingVoiceModeSwitchTraceRef.current = null;
  }
  if (refs.joinGenRef) {
    refs.joinGenRef.current += 1;
  }
  setJoinErrorFn(null);
  await resetVoiceSessionFn({ notifyServer: true });
  playLeaveChimeFn();
}

export async function handleUnexpectedVoiceSessionEnd(message, {
  targetChannelId = null,
  hasVoiceSession = false,
  advanceJoinGenerationFn = () => {},
  resetVoiceSessionFn = async () => {},
  setJoinErrorFn = () => {},
  setTimeoutFn = globalThis.setTimeout,
  sessionErrorTimeoutMs = 8000,
} = {}) {
  if (!hasVoiceSession) {
    return {
      handled: false,
    };
  }

  advanceJoinGenerationFn();
  await resetVoiceSessionFn({ channelId: targetChannelId, notifyServer: false });

  if (!message) {
    return {
      handled: true,
      joinErrorShown: false,
    };
  }

  setJoinErrorFn(message);
  setTimeoutFn(() => {
    setJoinErrorFn((current) => (current === message ? null : current));
  }, sessionErrorTimeoutMs);

  return {
    handled: true,
    joinErrorShown: true,
  };
}
