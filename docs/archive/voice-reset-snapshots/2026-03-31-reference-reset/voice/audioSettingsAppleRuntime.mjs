import { summarizeAudioContext } from '../../utils/voiceDiagnostics.js';
import { VOICE_NOISE_SUPPRESSION_BACKENDS } from '../../utils/voiceProcessing.js';
import {
  APPLE_VOICE_TEST_START_TIMEOUT_MS,
  roundMs,
  withTimeout,
} from './audioSettingsModel.mjs';
import {
  buildAudioSettingsAppleCleanupInput,
  buildAudioSettingsAppleStateFallbackUpdater,
  buildAudioSettingsAppleSuccessDiagnostics,
} from './audioSettingsAppleRuntimeContracts.mjs';
import { cleanupAudioSettingsAppleSetup } from './audioSettingsTestRuntime.mjs';

export async function startAudioSettingsAppleIsolationTest({
  refs = {},
  deps = {},
} = {}) {
  const {
    testRunIdRef = { current: 0 },
    animFrameRef = { current: null },
    appleVoiceFrameCleanupRef = { current: null },
    appleVoiceStateCleanupRef = { current: null },
    appleVoiceSourceNodeRef = { current: null },
    appleVoiceAvailableRef = { current: true },
    previewAudioRef = { current: null },
    audioCtxRef = { current: null },
    gainRef = { current: null },
  } = refs;

  const {
    activeVoiceMode,
    activeOutputId,
    monitorProfile,
    preferDirectMonitor = false,
    requestedOutputDeviceId = null,
    usedDefaultOutputFallback = false,
    noiseSuppressionEnabled = true,
    runId,
    testStart,
    testStartedAt,
    updateMicMeterFn = () => {},
    setTestDiagnosticsFn = () => {},
    setTestingFn = () => {},
    setTestStartingFn = () => {},
    attachMonitorOutputFn = async () => ({
      monitorSetupMs: null,
      playbackState: 'starting',
      playbackError: null,
    }),
    createApplePcmBridgeNodeFn = null,
    getFriendlyAppleVoiceFallbackMessageFn = (message) => message || null,
    normalizeElectronBinaryChunkFn = (chunk) => chunk,
    startAppleVoiceCaptureFn = null,
    stopAppleVoiceCaptureFn = null,
    isAppleVoiceCaptureSupportedFn = null,
    onAppleVoiceCaptureFrameFn = () => () => {},
    onAppleVoiceCaptureStateFn = () => () => {},
    getVoiceAudioContextOptionsFn = () => undefined,
    performanceNowFn = () => globalThis.performance?.now?.() ?? Date.now(),
    roundMsFn = roundMs,
    withTimeoutFn = withTimeout,
    summarizeAudioContextFn = summarizeAudioContext,
    requestAnimationFrameFn = globalThis.requestAnimationFrame,
    audioContextCtor = globalThis.AudioContext,
    readStoredMicGainFn = () => parseFloat(globalThis.localStorage?.getItem?.('voice:micGain') || '3'),
    appleVoiceTestStartTimeoutMs = APPLE_VOICE_TEST_START_TIMEOUT_MS,
    voiceNoiseSuppressionBackendApple = VOICE_NOISE_SUPPRESSION_BACKENDS.APPLE,
  } = deps;

  if (!startAppleVoiceCaptureFn || !isAppleVoiceCaptureSupportedFn || !createApplePcmBridgeNodeFn) {
    return false;
  }

  const supported = await isAppleVoiceCaptureSupportedFn().catch(() => false);
  if (!supported) {
    appleVoiceAvailableRef.current = false;
    return false;
  }

  let helperStartMs = null;
  let audioGraphSetupMs = null;
  let monitorSetupMs = null;
  let monitorPlaybackState = 'starting';
  let monitorPlaybackError = null;
  let helperMetadata = null;

  try {
    const audioGraphStart = performanceNowFn();
    const ctx = new audioContextCtor(getVoiceAudioContextOptionsFn());
    audioCtxRef.current = ctx;
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }

    const sourceNode = await createApplePcmBridgeNodeFn(ctx);
    appleVoiceSourceNodeRef.current = sourceNode;

    const gain = ctx.createGain();
    gain.gain.value = readStoredMicGainFn();
    gainRef.current = gain;
    sourceNode.connect(gain);
    audioGraphSetupMs = roundMsFn(performanceNowFn() - audioGraphStart);

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    gain.connect(analyser);

    appleVoiceFrameCleanupRef.current = onAppleVoiceCaptureFrameFn((chunk) => {
      if (testRunIdRef.current !== runId || !appleVoiceSourceNodeRef.current) {
        return;
      }

      const normalizedChunk = normalizeElectronBinaryChunkFn(chunk);
      if (!normalizedChunk) {
        return;
      }

      appleVoiceSourceNodeRef.current.port.postMessage(
        { type: 'push', samples: normalizedChunk },
        [normalizedChunk]
      );
    });

    appleVoiceStateCleanupRef.current = onAppleVoiceCaptureStateFn((payload) => {
      if (testRunIdRef.current !== runId || !payload) {
        return;
      }

      if (payload.type === 'unavailable') {
        appleVoiceAvailableRef.current = false;
      }

      if (payload.type === 'error' || payload.type === 'ended') {
        setTestDiagnosticsFn(buildAudioSettingsAppleStateFallbackUpdater({
          payload,
          noiseSuppressionEnabled,
          getFriendlyAppleVoiceFallbackMessageFn,
        }));
      }
    });

    const helperStart = performanceNowFn();
    const helperStartPromise = withTimeoutFn(
      startAppleVoiceCaptureFn(),
      appleVoiceTestStartTimeoutMs,
      'macOS Voice Isolation took too long to start.'
    );

    const monitorResult = await attachMonitorOutputFn({
      ctx,
      gainNode: gain,
      activeOutputId,
      monitorProfile,
      preferDirectMonitor,
    });

    helperMetadata = await helperStartPromise;
    if (helperMetadata?.configuration && helperMetadata.configuration !== 'full-duplex') {
      throw new Error('Mac voice cleanup is unavailable in this audio configuration.');
    }
    helperStartMs = roundMsFn(performanceNowFn() - helperStart);
    monitorSetupMs = monitorResult.monitorSetupMs;
    monitorPlaybackState = monitorResult.playbackState;
    monitorPlaybackError = monitorResult.playbackError;

    if (testRunIdRef.current !== runId) {
      await cleanupAudioSettingsAppleSetup(buildAudioSettingsAppleCleanupInput({
        refs: {
          appleVoiceFrameCleanupRef,
          appleVoiceStateCleanupRef,
          appleVoiceSourceNodeRef,
          previewAudioRef,
          audioCtxRef,
        },
        stopAppleVoiceCaptureFn,
      }));
      return true;
    }

    setTestDiagnosticsFn(buildAudioSettingsAppleSuccessDiagnostics({
      testStartedAt,
      activeVoiceMode,
      helperMetadata,
      summarizeAudioContextFn,
      ctx,
      voiceNoiseSuppressionBackendApple,
      noiseSuppressionEnabled,
      helperStartMs,
      monitorPlaybackState,
      monitorPlaybackError,
      activeOutputId,
      monitorProfile,
      requestedOutputDeviceId,
      usedDefaultOutputFallback,
      audioGraphSetupMs,
      monitorSetupMs,
      totalMs: roundMsFn(performanceNowFn() - testStart),
    }));

    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((sum, value) => sum + value, 0) / data.length;
      updateMicMeterFn(Math.min(100, (avg / 128) * 100));
      animFrameRef.current = requestAnimationFrameFn(tick);
    };
    tick();
    setTestingFn(true);
    setTestStartingFn(false);
    return true;
  } catch (error) {
    await cleanupAudioSettingsAppleSetup(buildAudioSettingsAppleCleanupInput({
      refs: {
        appleVoiceFrameCleanupRef,
        appleVoiceStateCleanupRef,
        appleVoiceSourceNodeRef,
        previewAudioRef,
        audioCtxRef,
      },
      stopAppleVoiceCaptureFn,
    }));
    throw error;
  }
}
