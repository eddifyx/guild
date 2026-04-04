import { playStreamStartChime } from '../../utils/chime.js';
import { summarizeTrackSnapshot } from '../../utils/voiceDiagnostics.js';
import { attachSenderEncryption } from '../../crypto/voiceEncryption.js';
import { useVoiceScreenShareBindingsController } from './useVoiceScreenShareBindingsController.mjs';
import { useVoiceScreenShareActionController } from './useVoiceScreenShareActionController.mjs';
import {
  buildVoiceScreenShareActionControllerOptions,
  buildVoiceScreenShareActionRuntime,
  buildVoiceScreenShareRuntimeControllerOptions,
} from './voiceHookBindings.mjs';
import { runVoiceScreenShareStartFlow } from './voiceScreenShareFlow.mjs';
import {
  applySenderPreferences,
  normalizeVoiceErrorMessage,
  summarizeSenderParameters,
} from './voiceRuntimeUtils.mjs';
import {
  applyPreferredScreenShareConstraints,
  getExperimentalScreenVideoBypassMode,
  getPreferredScreenShareCodecCandidates,
  getPrimaryCodecMimeTypeFromRtpParameters,
  getRuntimeScreenShareCodecMode,
  getScreenShareRequestedCapture,
  getSimulcastScreenShareEncodings,
  getSingleScreenShareEncoding,
  SCREEN_SHARE_ADAPTATION_HOLD_MS,
  SCREEN_SHARE_INITIAL_PROFILE_INDEX,
  SCREEN_SHARE_PROFILES,
  SCREEN_SHARE_PROMOTION_FAILURE_COOLDOWN_MS,
  summarizeScreenShareHardware,
  summarizeScreenShareProfile,
  summarizeSelectedCodec,
} from './screenShareProfile.mjs';
import { decideScreenShareAdaptation } from './screenShareAdaptation.mjs';
import {
  buildScreenShareStartError,
  logScreenShareFailureContext,
} from './screenShareFailure.mjs';

const SCREEN_SHARE_AUDIO_MAX_BITRATE = 96_000;

export function useVoiceHookScreenShareControllerRuntime({
  socket = null,
  state = {},
  refs = {},
  runtime = {},
} = {}) {
  const {
    ensureSecureMediaReadyFn = async () => {},
    ensureVoiceKeyForParticipantsFn = async () => {},
    getOrCreateScreenSendTransportFn = async () => null,
  } = runtime;
  const { setScreenShareDiagnostics } = state;
  const { stopScreenShareRef } = refs;

  const voiceScreenShareRuntimeBindings = useVoiceScreenShareBindingsController(
    buildVoiceScreenShareRuntimeControllerOptions({
      state,
      refs,
      runtime: {
        getPreferredScreenShareCodecCandidatesFn: getPreferredScreenShareCodecCandidates,
        getSimulcastScreenShareEncodingsFn: getSimulcastScreenShareEncodings,
        getSingleScreenShareEncodingFn: getSingleScreenShareEncoding,
        applySenderPreferencesFn: applySenderPreferences,
        attachSenderEncryptionFn: attachSenderEncryption,
        getPrimaryCodecMimeTypeFromRtpParametersFn: getPrimaryCodecMimeTypeFromRtpParameters,
        getExperimentalScreenVideoBypassModeFn: getExperimentalScreenVideoBypassMode,
        applyPreferredScreenShareConstraintsFn: applyPreferredScreenShareConstraints,
        summarizeTrackSnapshotFn: summarizeTrackSnapshot,
        summarizeScreenShareProfileFn: summarizeScreenShareProfile,
        summarizeSenderParametersFn: summarizeSenderParameters,
        summarizeScreenShareHardwareFn: summarizeScreenShareHardware,
        summarizeSelectedCodecFn: summarizeSelectedCodec,
        normalizeVoiceErrorMessageFn: normalizeVoiceErrorMessage,
        decideScreenShareAdaptationFn: decideScreenShareAdaptation,
        getRuntimeScreenShareCodecModeFn: getRuntimeScreenShareCodecMode,
        performanceNowFn: () => performance.now(),
        nowIsoFn: () => new Date().toISOString(),
        warnFn: console.warn,
      },
      constants: {
        screenShareProfiles: SCREEN_SHARE_PROFILES,
        promotionFailureCooldownMs: SCREEN_SHARE_PROMOTION_FAILURE_COOLDOWN_MS,
        adaptationHoldMs: SCREEN_SHARE_ADAPTATION_HOLD_MS,
        initialProfileIndex: SCREEN_SHARE_INITIAL_PROFILE_INDEX,
      },
      deps: [setScreenShareDiagnostics],
    })
  );

  const {
    resetScreenShareAdaptation,
    publishScreenShareVideoProducer,
    maybeAdaptScreenShareProfile,
  } = voiceScreenShareRuntimeBindings;

  const {
    confirmScreenShare,
    startScreenShare,
    cancelSourcePicker,
    stopScreenShare,
    clearScreenShareError,
  } = useVoiceScreenShareActionController(
    buildVoiceScreenShareActionControllerOptions({
      state,
      refs,
      runtime: buildVoiceScreenShareActionRuntime({
        ensureSecureMediaReadyFn,
        ensureVoiceKeyForParticipantsFn,
        getOrCreateScreenSendTransportFn,
        getRuntimeScreenShareCodecModeFn: getRuntimeScreenShareCodecMode,
        getPreferredScreenShareCodecCandidatesFn: getPreferredScreenShareCodecCandidates,
        resetScreenShareAdaptationFn: resetScreenShareAdaptation,
        applyPreferredScreenShareConstraintsFn: applyPreferredScreenShareConstraints,
        playStreamStartChimeFn: playStreamStartChime,
        cleanupVoiceScreenShareSessionFn: runtime.cleanupScreenShareSessionFn,
        publishScreenShareVideoProducerFn: publishScreenShareVideoProducer,
        applySenderPreferencesFn: applySenderPreferences,
        attachSenderEncryptionFn: attachSenderEncryption,
        socket,
        onVideoTrackEndedFn: () => {
          stopScreenShareRef?.current?.();
        },
        buildScreenShareStartErrorFn: buildScreenShareStartError,
        logScreenShareFailureContextFn: logScreenShareFailureContext,
        summarizeSelectedCodecFn: summarizeSelectedCodec,
        summarizeTrackSnapshotFn: summarizeTrackSnapshot,
        summarizeScreenShareProfileFn: summarizeScreenShareProfile,
        summarizeScreenShareHardwareFn: summarizeScreenShareHardware,
        summarizeSenderParametersFn: summarizeSenderParameters,
        getScreenShareRequestedCaptureFn: getScreenShareRequestedCapture,
        getPlatformFn: () => window.electronAPI?.getPlatform?.(),
        runVoiceScreenShareStartFlowFn: runVoiceScreenShareStartFlow,
      }),
      constants: {
        screenShareProfiles: SCREEN_SHARE_PROFILES,
        initialProfileIndex: SCREEN_SHARE_INITIAL_PROFILE_INDEX,
        screenShareAudioMaxBitrate: SCREEN_SHARE_AUDIO_MAX_BITRATE,
      },
      deps: [
        runtime.cleanupScreenShareSessionFn,
        ensureSecureMediaReadyFn,
        ensureVoiceKeyForParticipantsFn,
        getOrCreateScreenSendTransportFn,
        socket,
      ],
    })
  );

  return {
    resetScreenShareAdaptation,
    publishScreenShareVideoProducer,
    maybeAdaptScreenShareProfile,
    confirmScreenShare,
    startScreenShare,
    cancelSourcePicker,
    stopScreenShare,
    clearScreenShareError,
  };
}
