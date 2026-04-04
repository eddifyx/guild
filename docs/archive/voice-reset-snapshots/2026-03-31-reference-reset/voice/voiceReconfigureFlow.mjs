export async function reconfigureVoiceLiveCapture({
  refs = {},
  perfTraceId = null,
  addPerfPhaseFn = () => {},
  endPerfTraceFn = () => {},
  cancelPerfTraceFn = () => {},
  applyLiveCaptureToProducerFn = async () => {},
  normalizeVoiceErrorMessageFn = (error) => error?.message || '',
  warnFn = () => {},
} = {}) {
  const activeChannelId = refs.channelIdRef?.current;
  if (!activeChannelId) {
    cancelPerfTraceFn(perfTraceId, {
      reason: 'no-active-channel',
    });
    if (refs.pendingVoiceModeSwitchTraceRef?.current === perfTraceId) {
      refs.pendingVoiceModeSwitchTraceRef.current = null;
    }
    return;
  }

  try {
    addPerfPhaseFn(perfTraceId, 'reconfigure-start');
    await applyLiveCaptureToProducerFn({ chId: activeChannelId, perfTraceId });
  } catch (err) {
    warnFn('[Voice] Live capture reconfigure failed:', err);
    endPerfTraceFn(perfTraceId, {
      status: 'error',
      error: normalizeVoiceErrorMessageFn(err),
    });
    if (refs.pendingVoiceModeSwitchTraceRef?.current === perfTraceId) {
      refs.pendingVoiceModeSwitchTraceRef.current = null;
    }
  }
}

export function scheduleVoiceHealthProbeFlow({
  chId = null,
  delayMs = 2500,
  reason = 'join',
  refs = {},
  clearVoiceHealthProbeFn = () => {},
  setTimeoutFn = globalThis.setTimeout,
  runVoiceHealthProbeCheckFn = async () => ({ shouldReschedule: false }),
  summarizeProducerStatsFn = () => null,
  updateVoiceDiagnosticsFn = () => {},
  reconfigureLiveCaptureFn = async () => {},
  warnFn = () => {},
  rescheduleFn = () => {},
} = {}) {
  if (!chId) {
    return null;
  }

  clearVoiceHealthProbeFn();

  const timeoutId = setTimeoutFn(async () => {
    if (refs.voiceHealthProbeTimeoutRef) {
      refs.voiceHealthProbeTimeoutRef.current = null;
    }

    const probeResult = await runVoiceHealthProbeCheckFn({
      chId,
      reason,
      currentChannelId: refs.channelIdRef?.current,
      muted: Boolean(refs.mutedRef?.current),
      producer: refs.producerRef?.current,
      retryCountRef: refs.voiceHealthProbeRetryCountRef,
      summarizeProducerStatsFn,
      updateVoiceDiagnosticsFn,
      reconfigureLiveCaptureFn,
      warnFn,
    });

    if (probeResult.shouldReschedule && refs.channelIdRef?.current === chId && !refs.mutedRef?.current) {
      rescheduleFn(chId, {
        delayMs: 2500,
        reason: 'post-reconfigure',
      });
    }
  }, delayMs);

  if (refs.voiceHealthProbeTimeoutRef) {
    refs.voiceHealthProbeTimeoutRef.current = timeoutId;
  }
  return timeoutId;
}

export function scheduleVoiceLiveReconfigureFlow({
  perfTraceId = null,
  refs = {},
  clearTimeoutFn = globalThis.clearTimeout,
  setTimeoutFn = globalThis.setTimeout,
  cancelPerfTraceFn = () => {},
  addPerfPhaseFn = () => {},
  reconfigureLiveCaptureFn = async () => {},
} = {}) {
  if (!refs.channelIdRef?.current) {
    cancelPerfTraceFn(perfTraceId, {
      reason: 'no-active-channel',
    });
    if (refs.pendingVoiceModeSwitchTraceRef?.current === perfTraceId) {
      refs.pendingVoiceModeSwitchTraceRef.current = null;
    }
    return null;
  }

  if (refs.pendingLiveReconfigureRef?.current) {
    clearTimeoutFn(refs.pendingLiveReconfigureRef.current);
  }
  addPerfPhaseFn(perfTraceId, 'queued');

  const timeoutId = setTimeoutFn(() => {
    if (refs.pendingLiveReconfigureRef) {
      refs.pendingLiveReconfigureRef.current = null;
    }
    if (!refs.channelIdRef?.current) {
      cancelPerfTraceFn(perfTraceId, {
        reason: 'channel-ended-before-reconfigure',
      });
      if (refs.pendingVoiceModeSwitchTraceRef?.current === perfTraceId) {
        refs.pendingVoiceModeSwitchTraceRef.current = null;
      }
      return;
    }
    void reconfigureLiveCaptureFn({ perfTraceId });
  }, 16);

  if (refs.pendingLiveReconfigureRef) {
    refs.pendingLiveReconfigureRef.current = timeoutId;
  }
  return timeoutId;
}
