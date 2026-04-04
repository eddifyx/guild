import {
  getStoredVoiceProcessingMode,
  isUltraLowLatencyMode,
} from '../../utils/voiceProcessing.js';
import { APPLE_VOICE_CAPTURE_OWNERS } from '../../utils/appleVoiceCapture.js';
import {
  addPerfPhase,
  cancelPerfTrace,
  endPerfTrace,
} from '../../utils/devPerf.js';
import { attachSenderEncryption } from '../../crypto/voiceEncryption.js';
import {
  summarizeProducerStats,
  summarizeTrackSnapshot,
} from '../../utils/voiceDiagnostics.js';
import {
  applyVoiceLiveCaptureProducer,
  attachLiveCaptureProducer,
} from './voiceProducerFlow.mjs';
import { switchVoiceCaptureRoutingMode } from './voiceCaptureRoutingMode.mjs';
import { startVoiceVadRuntime } from './voiceVadRuntime.mjs';
import { runVoiceHealthProbeCheck } from './voiceHealthProbeRuntime.mjs';
import { useVoiceCaptureActionController } from './useVoiceCaptureActionController.mjs';
import { useVoiceLiveCaptureRuntimeController } from './useVoiceLiveCaptureRuntimeController.mjs';
import {
  buildVoiceCaptureActionControllerOptions,
  buildVoiceCaptureActionRuntime,
  buildVoiceLiveCaptureRuntimeControllerOptions,
} from './voiceHookBindings.mjs';
import {
  reconfigureVoiceLiveCapture,
  scheduleVoiceHealthProbeFlow,
} from './voiceReconfigureFlow.mjs';
import {
  normalizeVoiceErrorMessage,
  roundMs,
} from './voiceRuntimeUtils.mjs';
import { VOICE_RECOVERY_RUNTIME } from './voiceRecoveryConfig.mjs';

const RNNOISE_SEND_MAKEUP_GAIN = 2.4;
const APPLE_VOICE_LIVE_START_TIMEOUT_MS = 3200;
const VOICE_MAX_BITRATE = 64_000;
const {
  voiceSafeMode: VOICE_SAFE_MODE,
  voiceEmergencyDirectSourceTrack: VOICE_EMERGENCY_DIRECT_SOURCE_TRACK,
  disableOpusDtx: VOICE_RECOVERY_DISABLE_OPUS_DTX,
  forceFreshRawMicCapture: VOICE_RECOVERY_FORCE_FRESH_RAW_MIC_CAPTURE,
} = VOICE_RECOVERY_RUNTIME;

export function useVoiceHookCaptureControllerRuntime({
  socket = null,
  state = {},
  refs = {},
  runtime = {},
} = {}) {
  const {
    applyNoiseSuppressionRoutingFn = () => {},
    updateVoiceDiagnosticsFn = () => {},
    applySenderPreferencesFn = async () => {},
    getVoiceAudioBypassModeFn = () => null,
  } = runtime;

  const voiceLiveCaptureBindings = useVoiceLiveCaptureRuntimeController(
    buildVoiceLiveCaptureRuntimeControllerOptions({
      state,
      refs,
      runtime: {
        clearTimeoutFn: clearTimeout,
        updateVoiceDiagnosticsFn,
        addPerfPhaseFn: addPerfPhase,
        endPerfTraceFn: endPerfTrace,
        switchVoiceCaptureRoutingModeFn: switchVoiceCaptureRoutingMode,
        isUltraLowLatencyModeFn: isUltraLowLatencyMode,
        applyNoiseSuppressionRoutingFn,
        stopAppleVoiceCaptureFn: window.electronAPI?.stopAppleVoiceCapture,
        getStoredVoiceProcessingModeFn: getStoredVoiceProcessingMode,
        startAppleVoiceCaptureFn: window.electronAPI?.startAppleVoiceCapture,
        isAppleVoiceCaptureSupportedFn: window.electronAPI?.isAppleVoiceCaptureSupported,
        onAppleVoiceCaptureFrameFn: window.electronAPI?.onAppleVoiceCaptureFrame,
        onAppleVoiceCaptureStateFn: window.electronAPI?.onAppleVoiceCaptureState,
        audioContextCtor: AudioContext,
        performanceNowFn: () => performance.now(),
        nowIsoFn: () => new Date().toISOString(),
        roundMsFn: roundMs,
        summarizeTrackSnapshotFn: summarizeTrackSnapshot,
        warnFn: console.warn,
      },
      constants: {
        voiceSafeMode: VOICE_SAFE_MODE,
        voiceEmergencyDirectSourceTrack: VOICE_EMERGENCY_DIRECT_SOURCE_TRACK,
        forceFreshRawMicCapture: VOICE_RECOVERY_FORCE_FRESH_RAW_MIC_CAPTURE,
        appleVoiceCaptureOwner: APPLE_VOICE_CAPTURE_OWNERS.LIVE_VOICE,
        appleVoiceLiveStartTimeoutMs: APPLE_VOICE_LIVE_START_TIMEOUT_MS,
        rnnoiseSendMakeupGain: RNNOISE_SEND_MAKEUP_GAIN,
      },
      deps: [applyNoiseSuppressionRoutingFn, updateVoiceDiagnosticsFn],
    })
  );

  const {
    clearVoiceHealthProbe,
    switchLiveCaptureModeInPlace,
    syncLiveCaptureRefs,
    disposeLiveCapture,
    createLiveMicCapture,
  } = voiceLiveCaptureBindings;

  const voiceCaptureActions = useVoiceCaptureActionController(
    buildVoiceCaptureActionControllerOptions({
      state,
      refs,
      runtime: buildVoiceCaptureActionRuntime({
        socket,
        startVoiceVadRuntimeFn: startVoiceVadRuntime,
        onVadError: (error) => {
          console.error('VAD setup failed:', error);
        },
        applyVoiceLiveCaptureProducerFn: applyVoiceLiveCaptureProducer,
        createLiveMicCaptureFn: createLiveMicCapture,
        getStoredVoiceProcessingModeFn: getStoredVoiceProcessingMode,
        disposeLiveCaptureFn: disposeLiveCapture,
        attachLiveCaptureProducerFn: ({ previousProducer, nextCapture, nextDiagnostics, sendTransport, ...rest }) => (
          attachLiveCaptureProducer({
            previousProducer,
            nextCapture,
            nextDiagnostics,
            sendTransport,
            ...rest,
            applySenderPreferencesFn: async (rtpSender, options) => {
              try {
                await applySenderPreferencesFn(rtpSender, options);
              } catch (senderPreferenceErr) {
                console.warn('[Voice] Failed to raise microphone sender priority:', senderPreferenceErr);
              }
            },
          })
        ),
        getVoiceAudioBypassModeFn,
        attachSenderEncryptionFn: attachSenderEncryption,
        roundMsFn: roundMs,
        syncLiveCaptureRefsFn: syncLiveCaptureRefs,
        updateVoiceDiagnosticsFn,
        addPerfPhaseFn: addPerfPhase,
        endPerfTraceFn: endPerfTrace,
        cancelPerfTraceFn: cancelPerfTrace,
        normalizeVoiceErrorMessageFn: normalizeVoiceErrorMessage,
        reconfigureVoiceLiveCaptureFn: reconfigureVoiceLiveCapture,
        warnFn: console.warn,
        scheduleVoiceHealthProbeFlowFn: scheduleVoiceHealthProbeFlow,
        clearVoiceHealthProbeFn: clearVoiceHealthProbe,
        setTimeoutFn: window.setTimeout.bind(window),
        runVoiceHealthProbeCheckFn: runVoiceHealthProbeCheck,
        summarizeProducerStatsFn: summarizeProducerStats,
      }),
      constants: {
        voiceMaxBitrate: VOICE_MAX_BITRATE,
        disableOpusDtx: VOICE_RECOVERY_DISABLE_OPUS_DTX,
        voiceSafeMode: VOICE_SAFE_MODE,
      },
      deps: [
        attachSenderEncryption,
        clearVoiceHealthProbe,
        createLiveMicCapture,
        disposeLiveCapture,
        socket,
        syncLiveCaptureRefs,
        updateVoiceDiagnosticsFn,
      ],
    })
  );

  return {
    clearVoiceHealthProbe,
    switchLiveCaptureModeInPlace,
    syncLiveCaptureRefs,
    disposeLiveCapture,
    createLiveMicCapture,
    applyLiveCaptureToProducer: voiceCaptureActions.applyLiveCaptureToProducer,
    reconfigureLiveCapture: voiceCaptureActions.reconfigureLiveCapture,
    scheduleVoiceHealthProbe: voiceCaptureActions.scheduleVoiceHealthProbe,
  };
}
