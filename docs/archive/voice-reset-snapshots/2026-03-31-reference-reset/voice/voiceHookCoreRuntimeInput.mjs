import { playStreamStopChime } from '../../utils/chime.js';
import { recordLaneDiagnostic } from '../../utils/laneDiagnostics.js';
import { clearVoiceKey } from '../../crypto/voiceEncryption.js';
import {
  applySenderPreferences,
  getVoiceAudioBypassMode,
} from './voiceRuntimeUtils.mjs';
import { VOICE_RECOVERY_RUNTIME } from './voiceRecoveryConfig.mjs';
import {
  getExperimentalScreenVideoBypassMode,
  getPrimaryCodecMimeTypeFromRtpParameters,
  summarizeReceiverVideoCodecSupport,
} from './screenShareProfile.mjs';
import { buildUseVoiceHookCoreRuntimeControllerOptions } from './voiceHookControllerOptions.mjs';

export function buildUseVoiceHookCoreRuntimeInput({
  socket = null,
  userId = null,
  voiceState = {},
  voiceRefs = {},
  updateVoiceDiagnosticsFn,
  applyNoiseSuppressionRoutingFn,
  emitAsyncFn,
} = {}) {
  const { disableVoiceInsertableStreams } = VOICE_RECOVERY_RUNTIME;

  return buildUseVoiceHookCoreRuntimeControllerOptions({
    socket,
    userId,
    state: voiceState,
    refs: voiceRefs,
    clearVoiceKeyFn: clearVoiceKey,
    updateVoiceDiagnosticsFn,
    applyNoiseSuppressionRoutingFn,
    applySenderPreferencesFn: applySenderPreferences,
    getVoiceAudioBypassModeFn: (payload = {}) => (
      getVoiceAudioBypassMode({
        ...payload,
        disableVoiceInsertableStreams,
      })
    ),
    emitAsyncFn,
    recordLaneDiagnosticFn: recordLaneDiagnostic,
    playStreamStopChimeFn: playStreamStopChime,
    getPrimaryCodecMimeTypeFromRtpParametersFn: getPrimaryCodecMimeTypeFromRtpParameters,
    getExperimentalScreenVideoBypassModeFn: getExperimentalScreenVideoBypassMode,
    summarizeReceiverVideoCodecSupportFn: summarizeReceiverVideoCodecSupport,
  });
}
