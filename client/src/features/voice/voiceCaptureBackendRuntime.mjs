import {
  getNoiseSuppressionRuntimeState,
  VOICE_NOISE_SUPPRESSION_BACKENDS,
} from '../../utils/voiceProcessing.js';
import {
  ensureVoiceCaptureBypassRouting,
} from './voiceLiveCaptureState.mjs';
import {
  buildAppleDirectFallbackSuppressionRuntime,
  buildRnnoiseFallbackSuppressionRuntime,
  shouldUseDirectMicLane,
} from './voiceLiveCaptureConfig.mjs';
import {
  startVoiceCaptureBackend,
} from './voiceBackendFlow.mjs';
import {
  applyVoiceProcessingFallbackState,
  cleanupAppleVoiceProcessingLane,
  startRnnoiseVoiceProcessingLane,
} from './voiceLiveCaptureProcessing.mjs';
import {
  startAppleVoiceProcessingLane,
} from './voiceAppleProcessing.mjs';

export function applyVoiceProcessingRouting(routing, enabled) {
  if (!routing) return false;
  const usingProcessedLane = Boolean(enabled && routing.processedReady);
  const directGain = routing.rawBypassGain || routing.directGain || null;
  if (!directGain?.gain || !routing.processedGain?.gain) return false;
  directGain.gain.value = usingProcessedLane ? 0 : 1;
  routing.processedGain.gain.value = usingProcessedLane ? 1 : 0;
  return usingProcessedLane;
}

export async function withVoiceProcessingTimeout(promise, timeoutMs, timeoutMessage) {
  let timeoutId = null;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(timeoutMessage));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId !== null) clearTimeout(timeoutId);
  }
}

export async function resolveVoiceNoiseRuntimeDeps({
  createNoiseGateNodeFn = null,
  createRnnoiseNodeFn = null,
  createSpeexNodeFn = null,
  createKeyboardSuppressorNodeFn = null,
  createSpeechFocusChainFn = null,
} = {}) {
  if (
    createNoiseGateNodeFn
    && createRnnoiseNodeFn
    && createSpeexNodeFn
    && createKeyboardSuppressorNodeFn
    && createSpeechFocusChainFn
  ) {
    return {
      createNoiseGateNodeFn,
      createRnnoiseNodeFn,
      createSpeexNodeFn,
      createKeyboardSuppressorNodeFn,
      createSpeechFocusChainFn,
    };
  }

  const [
    rnnoiseModule,
    keyboardSuppressorModule,
    voiceToneShapingModule,
  ] = await Promise.all([
    import('../../utils/rnnoise.js'),
    import('../../utils/keyboardSuppressor.js'),
    import('../../utils/voiceToneShaping.js'),
  ]);

  return {
    createNoiseGateNodeFn: createNoiseGateNodeFn || rnnoiseModule.createNoiseGateNode,
    createRnnoiseNodeFn: createRnnoiseNodeFn || rnnoiseModule.createRnnoiseNode,
    createSpeexNodeFn: createSpeexNodeFn || rnnoiseModule.createSpeexNode,
    createKeyboardSuppressorNodeFn: createKeyboardSuppressorNodeFn || keyboardSuppressorModule.createKeyboardSuppressorNode,
    createSpeechFocusChainFn: createSpeechFocusChainFn || voiceToneShapingModule.createSpeechFocusChain,
  };
}

export async function resolveAppleVoiceRuntimeDeps({
  createApplePcmBridgeNodeFn = null,
  getFriendlyAppleVoiceFallbackMessageFn = null,
  normalizeElectronBinaryChunkFn = null,
  shouldDisableAppleVoiceForSessionFn = null,
} = {}) {
  if (
    createApplePcmBridgeNodeFn
    && getFriendlyAppleVoiceFallbackMessageFn
    && normalizeElectronBinaryChunkFn
    && shouldDisableAppleVoiceForSessionFn
  ) {
    return {
      createApplePcmBridgeNodeFn,
      getFriendlyAppleVoiceFallbackMessageFn,
      normalizeElectronBinaryChunkFn,
      shouldDisableAppleVoiceForSessionFn,
    };
  }

  const appleVoiceCaptureModule = await import('../../utils/appleVoiceCapture.js');
  return {
    createApplePcmBridgeNodeFn: createApplePcmBridgeNodeFn || appleVoiceCaptureModule.createApplePcmBridgeNode,
    getFriendlyAppleVoiceFallbackMessageFn: getFriendlyAppleVoiceFallbackMessageFn || appleVoiceCaptureModule.getFriendlyAppleVoiceFallbackMessage,
    normalizeElectronBinaryChunkFn: normalizeElectronBinaryChunkFn || appleVoiceCaptureModule.normalizeElectronBinaryChunk,
    shouldDisableAppleVoiceForSessionFn: shouldDisableAppleVoiceForSessionFn || appleVoiceCaptureModule.shouldDisableAppleVoiceForSession,
  };
}

export async function startVoiceCaptureProcessingBackend({
  capture,
  micCtx,
  micSource,
  gainNode,
  useRawMicPath = false,
  suppressionRuntime = null,
  activeVoiceProcessingMode = null,
  noiseSuppressionEnabled = false,
  requestedSuppressionRuntime = null,
  filterDiagnostics = null,
  refs = {},
  deps = {},
} = {}) {
  const {
    liveCaptureRef = { current: null },
    appleVoiceAvailableRef = { current: false },
  } = refs;
  const {
    rnnoiseSendMakeupGain = 1,
    appleVoiceCaptureOwner = 'LIVE_VOICE',
    appleVoiceLiveStartTimeoutMs = 3200,
    updateVoiceDiagnosticsFn = () => {},
    setLiveVoiceFallbackReasonFn = () => {},
    createNoiseGateNodeFn = null,
    createRnnoiseNodeFn = null,
    createSpeexNodeFn = null,
    createKeyboardSuppressorNodeFn = null,
    createSpeechFocusChainFn = null,
    createApplePcmBridgeNodeFn = null,
    getFriendlyAppleVoiceFallbackMessageFn = null,
    normalizeElectronBinaryChunkFn = null,
    shouldDisableAppleVoiceForSessionFn = null,
    startAppleVoiceCaptureFn = null,
    stopAppleVoiceCaptureFn = null,
    isAppleVoiceCaptureSupportedFn = null,
    onAppleVoiceCaptureFrameFn = () => () => {},
    onAppleVoiceCaptureStateFn = () => () => {},
    roundMsFn = (value) => value,
    ensureVoiceCaptureBypassRoutingFn = ensureVoiceCaptureBypassRouting,
    buildRnnoiseFallbackSuppressionRuntimeFn = buildRnnoiseFallbackSuppressionRuntime,
    buildAppleDirectFallbackSuppressionRuntimeFn = buildAppleDirectFallbackSuppressionRuntime,
    startVoiceCaptureBackendFn = startVoiceCaptureBackend,
    cleanupAppleVoiceProcessingLaneFn = cleanupAppleVoiceProcessingLane,
    startRnnoiseVoiceProcessingLaneFn = startRnnoiseVoiceProcessingLane,
    startAppleVoiceProcessingLaneFn = startAppleVoiceProcessingLane,
    applyVoiceProcessingFallbackStateFn = applyVoiceProcessingFallbackState,
    shouldUseDirectMicLaneFn = shouldUseDirectMicLane,
    getNoiseSuppressionRuntimeStateFn = getNoiseSuppressionRuntimeState,
    applyNoiseSuppressionRoutingFn = applyVoiceProcessingRouting,
    resolveVoiceNoiseRuntimeDepsFn = resolveVoiceNoiseRuntimeDeps,
    resolveAppleVoiceRuntimeDepsFn = resolveAppleVoiceRuntimeDeps,
    withTimeoutFn = withVoiceProcessingTimeout,
  } = deps;

  let nextSuppressionRuntime = suppressionRuntime;
  let workletCreateMs = null;
  const appleVoiceRuntimeDeps = nextSuppressionRuntime?.backend === VOICE_NOISE_SUPPRESSION_BACKENDS.APPLE
    ? await resolveAppleVoiceRuntimeDepsFn({
        createApplePcmBridgeNodeFn,
        getFriendlyAppleVoiceFallbackMessageFn,
        normalizeElectronBinaryChunkFn,
        shouldDisableAppleVoiceForSessionFn,
      })
    : null;

  const cleanupAppleLaneFn = async ({ releaseOwner = false } = {}) => {
    await cleanupAppleVoiceProcessingLaneFn(capture, {
      releaseOwner,
      stopAppleVoiceCaptureFn,
      appleVoiceCaptureOwner,
    });
  };

  const startAppleProcessingLaneRuntimeFn = async () => {
    const processingResult = await startAppleVoiceProcessingLaneFn({
      capture,
      micCtx,
      micSource,
      gainNode,
      noiseSuppressionEnabled,
      filterDiagnostics,
      suppressionRuntimeBackend: nextSuppressionRuntime?.backend,
      liveCaptureRef,
      appleVoiceAvailableRef,
      ensureVoiceCaptureBypassRoutingFn,
      createApplePcmBridgeNodeFn: appleVoiceRuntimeDeps.createApplePcmBridgeNodeFn,
      normalizeElectronBinaryChunkFn: appleVoiceRuntimeDeps.normalizeElectronBinaryChunkFn,
      getFriendlyAppleVoiceFallbackMessageFn: appleVoiceRuntimeDeps.getFriendlyAppleVoiceFallbackMessageFn,
      applyVoiceProcessingFallbackStateFn,
      applyNoiseSuppressionRoutingFn,
      setLiveVoiceFallbackReasonFn,
      updateVoiceDiagnosticsFn,
      startAppleVoiceCaptureFn,
      isAppleVoiceCaptureSupportedFn,
      onAppleVoiceCaptureFrameFn,
      onAppleVoiceCaptureStateFn,
      cleanupAppleLaneFn,
      withTimeoutFn,
      appleVoiceCaptureOwner,
      startTimeoutMs: appleVoiceLiveStartTimeoutMs,
      roundMsFn,
    });
    workletCreateMs = processingResult.workletCreateMs;
    return processingResult;
  };

  const startRnnoiseProcessingLaneRuntimeFn = async () => {
    const routing = ensureVoiceCaptureBypassRoutingFn(capture, {
      micCtx,
      micSource,
      gainNode,
    });
    const voiceNoiseRuntimeDeps = await resolveVoiceNoiseRuntimeDepsFn({
      createNoiseGateNodeFn,
      createRnnoiseNodeFn,
      createSpeexNodeFn,
      createKeyboardSuppressorNodeFn,
      createSpeechFocusChainFn,
    });
    const processingResult = await startRnnoiseVoiceProcessingLaneFn({
      capture,
      micCtx,
      micSource,
      routing,
      noiseSuppressionEnabled,
      suppressionRuntimeBackend: nextSuppressionRuntime?.backend,
      filterDiagnostics,
      applyNoiseSuppressionRoutingFn,
      createRnnoiseNodeFn: voiceNoiseRuntimeDeps.createRnnoiseNodeFn,
      createSpeexNodeFn: voiceNoiseRuntimeDeps.createSpeexNodeFn,
      createNoiseGateNodeFn: voiceNoiseRuntimeDeps.createNoiseGateNodeFn,
      createSpeechFocusChainFn: voiceNoiseRuntimeDeps.createSpeechFocusChainFn,
      createKeyboardSuppressorNodeFn: voiceNoiseRuntimeDeps.createKeyboardSuppressorNodeFn,
      rnnoiseSendMakeupGain,
      roundMsFn,
    });
    workletCreateMs = processingResult.workletCreateMs;
    return processingResult;
  };

  const backendResult = await startVoiceCaptureBackendFn({
    capture,
    micSource,
    gainNode,
    useRawMicPath,
    suppressionRuntime: nextSuppressionRuntime,
    activeVoiceProcessingMode,
    noiseSuppressionEnabled,
    requestedSuppressionRuntime,
    filterDiagnostics,
    appleVoiceAvailableRef,
    startAppleProcessingLaneFn: startAppleProcessingLaneRuntimeFn,
    startRnnoiseProcessingLaneFn: async (runtimeSuppressionRuntime = nextSuppressionRuntime) => {
      nextSuppressionRuntime = runtimeSuppressionRuntime;
      await startRnnoiseProcessingLaneRuntimeFn();
      return { workletCreateMs };
    },
    cleanupAppleLaneFn,
    shouldUseDirectMicLaneFn,
    shouldDisableAppleVoiceForSessionFn: appleVoiceRuntimeDeps?.shouldDisableAppleVoiceForSessionFn || (() => false),
    buildRnnoiseFallbackSuppressionRuntimeFn: ({
      activeVoiceProcessingMode: nextMode,
      noiseSuppressionEnabled: nextNoiseSuppressionEnabled,
      requestedSuppressionRuntime: nextRequestedSuppressionRuntime,
      fallbackReason,
      rnnoiseBackend,
    }) => buildRnnoiseFallbackSuppressionRuntimeFn({
      activeVoiceProcessingMode: nextMode,
      noiseSuppressionEnabled: nextNoiseSuppressionEnabled,
      requestedSuppressionRuntime: nextRequestedSuppressionRuntime,
      fallbackReason,
      getNoiseSuppressionRuntimeStateFn: getNoiseSuppressionRuntimeStateFn,
      rnnoiseBackend,
    }),
    buildAppleDirectFallbackSuppressionRuntimeFn: ({
      requestedSuppressionRuntime: nextRequestedSuppressionRuntime,
      fallbackReason,
    }) => buildAppleDirectFallbackSuppressionRuntimeFn({
      requestedSuppressionRuntime: nextRequestedSuppressionRuntime,
      fallbackReason,
    }),
    getFriendlyAppleVoiceFallbackMessageFn: appleVoiceRuntimeDeps?.getFriendlyAppleVoiceFallbackMessageFn || ((message) => message),
    applyVoiceProcessingFallbackStateFn,
    applyNoiseSuppressionRoutingFn,
    appleBackend: VOICE_NOISE_SUPPRESSION_BACKENDS.APPLE,
    webrtcApmBackend: VOICE_NOISE_SUPPRESSION_BACKENDS.WEBRTC_APM,
    rnnoiseBackend: VOICE_NOISE_SUPPRESSION_BACKENDS.RNNOISE,
  });

  return {
    suppressionRuntime: backendResult.suppressionRuntime,
    workletCreateMs: backendResult.workletCreateMs,
  };
}
