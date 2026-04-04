export function buildVoiceProducerCodecOptions({
  voiceMaxBitrate = 64_000,
  disableOpusDtx = false,
} = {}) {
  const codecOptions = {
    opusFec: true,
    opusPtime: 20,
    opusMaxAverageBitrate: voiceMaxBitrate,
  };
  if (!disableOpusDtx) {
    codecOptions.opusDtx = true;
  }
  return codecOptions;
}

export async function attachLiveCaptureProducer({
  previousProducer = null,
  nextCapture = null,
  nextDiagnostics = null,
  sendTransport = null,
  voiceMaxBitrate = 64_000,
  disableOpusDtx = false,
  voiceSafeMode = false,
  getVoiceAudioBypassModeFn = () => null,
  applySenderPreferencesFn = async () => {},
  attachSenderEncryptionFn = () => true,
  nowFn = () => globalThis.performance?.now?.() ?? Date.now(),
  roundMsFn = (value) => value,
} = {}) {
  if (!nextCapture?.outputTrack) {
    throw new Error('Voice capture output track is unavailable.');
  }

  const producerStart = nowFn();
  if (previousProducer) {
    await previousProducer.replaceTrack({ track: nextCapture.outputTrack });
    return {
      producer: previousProducer,
      producerOperation: 'replaceTrack',
      producerOpMs: roundMsFn(nowFn() - producerStart),
      bypassVoiceAudioEncryption: false,
      voiceAudioBypassMode: null,
    };
  }

  if (!sendTransport) {
    throw new Error('Voice send transport is unavailable.');
  }

  const producer = await sendTransport.produce({
    track: nextCapture.outputTrack,
    codecOptions: buildVoiceProducerCodecOptions({
      voiceMaxBitrate,
      disableOpusDtx,
    }),
    appData: {
      source: 'microphone',
      processingMode: nextDiagnostics?.mode || null,
    },
  });

  const voiceAudioBypassMode = getVoiceAudioBypassModeFn({
    kind: 'audio',
    source: 'microphone',
    voiceSafeMode,
  });
  const bypassVoiceAudioEncryption = Boolean(voiceAudioBypassMode);
  const rtpSender = producer.rtpSender;

  if (!rtpSender && !bypassVoiceAudioEncryption) {
    throw new Error('Voice chat is unavailable because secure media transforms could not attach.');
  }

  if (rtpSender) {
    try {
      await applySenderPreferencesFn(rtpSender, {
        maxBitrate: voiceMaxBitrate,
        priority: 'high',
        networkPriority: 'high',
      });
    } catch {}
  }

  if (!bypassVoiceAudioEncryption) {
    const senderEncryptionAttached = attachSenderEncryptionFn(rtpSender, {
      kind: 'audio',
      codecMimeType: 'audio/opus',
    });
    if (senderEncryptionAttached === false) {
      throw new Error('Voice chat is unavailable because secure media transforms could not attach.');
    }
  }

  return {
    producer,
    producerOperation: 'produce',
    producerOpMs: roundMsFn(nowFn() - producerStart),
    bypassVoiceAudioEncryption,
    voiceAudioBypassMode,
  };
}

export async function applyVoiceLiveCaptureProducer({
  chId = null,
  perfTraceId = null,
  refs = {},
  createLiveMicCaptureFn = async () => null,
  disposeLiveCaptureFn = async () => {},
  attachLiveCaptureProducerFn = attachLiveCaptureProducer,
  syncLiveCaptureRefsFn = () => {},
  updateVoiceDiagnosticsFn = () => {},
  setLiveVoiceFallbackReasonFn = () => {},
  startVadFn = () => {},
  setMutedFn = () => {},
  addPerfPhaseFn = () => {},
  endPerfTraceFn = () => {},
  cancelPerfTraceFn = () => {},
  normalizeVoiceErrorMessageFn = (error) => error?.message || '',
} = {}) {
  const configGen = ++refs.liveCaptureConfigGenRef.current;
  const previousCapture = refs.liveCaptureRef.current;
  const previousProducer = refs.producerRef.current;
  addPerfPhaseFn(perfTraceId, 'capture-build-start', {
    hadPreviousCapture: Boolean(previousCapture),
    producerOperation: previousProducer ? 'replaceTrack' : 'produce',
  });

  const nextCaptureState = await createLiveMicCaptureFn({
    chId,
    previousCapture,
  });
  addPerfPhaseFn(perfTraceId, 'capture-build-ready', {
    backend: nextCaptureState?.diagnostics?.filter?.backend || null,
    fallbackReason: nextCaptureState?.diagnostics?.filter?.fallbackReason || null,
    requestedBackend: nextCaptureState?.diagnostics?.filter?.requestedBackend || null,
    reusedSourceStream: nextCaptureState?.diagnostics?.reusedSourceStream || false,
  });

  if (configGen !== refs.liveCaptureConfigGenRef.current || refs.channelIdRef.current !== chId) {
    if (nextCaptureState?.capture) {
      await disposeLiveCaptureFn(nextCaptureState.capture);
    }
    cancelPerfTraceFn(perfTraceId, {
      reason: 'stale-config',
    });
    if (refs.pendingVoiceModeSwitchTraceRef.current === perfTraceId) {
      refs.pendingVoiceModeSwitchTraceRef.current = null;
    }
    return null;
  }

  if (!nextCaptureState?.capture) {
    if (!previousProducer) {
      setMutedFn(true);
      setLiveVoiceFallbackReasonFn(nextCaptureState?.diagnostics?.filter?.fallbackReason || null);
      updateVoiceDiagnosticsFn((prev) => ({
        ...prev,
        liveCapture: nextCaptureState?.diagnostics || null,
      }));
    }
    endPerfTraceFn(perfTraceId, {
      status: 'no-capture',
      backend: nextCaptureState?.diagnostics?.filter?.backend || null,
      fallbackReason: nextCaptureState?.diagnostics?.filter?.fallbackReason || null,
    });
    if (refs.pendingVoiceModeSwitchTraceRef.current === perfTraceId) {
      refs.pendingVoiceModeSwitchTraceRef.current = null;
    }
    return null;
  }

  let producerOpMs = null;
  try {
    const producerResult = await attachLiveCaptureProducerFn({
      previousProducer,
      nextCapture: nextCaptureState.capture,
      nextDiagnostics: nextCaptureState.diagnostics,
      sendTransport: refs.sendTransportRef.current,
    });
    refs.producerRef.current = producerResult.producer;
    producerOpMs = producerResult.producerOpMs;
    addPerfPhaseFn(
      perfTraceId,
      producerResult.producerOperation === 'replaceTrack' ? 'replace-track-ready' : 'producer-ready',
      { durationMs: producerOpMs }
    );
  } catch (err) {
    await disposeLiveCaptureFn(nextCaptureState.capture);
    endPerfTraceFn(perfTraceId, {
      status: 'error',
      error: normalizeVoiceErrorMessageFn(err),
    });
    if (refs.pendingVoiceModeSwitchTraceRef.current === perfTraceId) {
      refs.pendingVoiceModeSwitchTraceRef.current = null;
    }
    throw err;
  }

  if (configGen !== refs.liveCaptureConfigGenRef.current || refs.channelIdRef.current !== chId) {
    await disposeLiveCaptureFn(nextCaptureState.capture);
    cancelPerfTraceFn(perfTraceId, {
      reason: 'stale-after-producer',
    });
    if (refs.pendingVoiceModeSwitchTraceRef.current === perfTraceId) {
      refs.pendingVoiceModeSwitchTraceRef.current = null;
    }
    return null;
  }

  if (
    previousCapture
    && previousCapture !== nextCaptureState.capture
    && previousCapture.stream
    && previousCapture.stream === nextCaptureState.capture.stream
  ) {
    previousCapture.ownsStream = false;
    nextCaptureState.capture.ownsStream = true;
  }

  syncLiveCaptureRefsFn(nextCaptureState.capture);
  setLiveVoiceFallbackReasonFn(nextCaptureState.diagnostics.filter?.fallbackReason || null);
  updateVoiceDiagnosticsFn((prev) => ({
    ...prev,
    liveCapture: {
      ...nextCaptureState.diagnostics,
      timingsMs: {
        ...(nextCaptureState.diagnostics.timingsMs || {}),
        produce: previousProducer ? null : producerOpMs,
        replaceTrack: previousProducer ? producerOpMs : null,
      },
    },
  }));
  startVadFn(nextCaptureState.capture.vadNode || nextCaptureState.capture.gainNode);

  if (refs.producerRef.current) {
    if (refs.mutedRef.current) refs.producerRef.current.pause();
    else refs.producerRef.current.resume();
  }
  setMutedFn(refs.mutedRef.current);

  if (previousCapture && previousCapture !== nextCaptureState.capture) {
    await disposeLiveCaptureFn(previousCapture);
  }

  endPerfTraceFn(perfTraceId, {
    status: 'ready',
    backend: nextCaptureState?.diagnostics?.filter?.backend || null,
    fallbackReason: nextCaptureState?.diagnostics?.filter?.fallbackReason || null,
    producerOperation: previousProducer ? 'replaceTrack' : 'produce',
    mode: nextCaptureState?.diagnostics?.mode || null,
  });
  if (refs.pendingVoiceModeSwitchTraceRef.current === perfTraceId) {
    refs.pendingVoiceModeSwitchTraceRef.current = null;
  }

  return nextCaptureState.capture;
}
