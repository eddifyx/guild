import { recordLaneDiagnostic } from '../../utils/laneDiagnostics.js';
import {
  applyVoiceModeDependencies,
  isUltraLowLatencyMode,
  persistNoiseSuppressionEnabled,
  persistVoiceProcessingMode,
} from '../../utils/voiceProcessing.js';
import { clearVoiceKey } from '../../crypto/voiceEncryption.js';
import {
  isExpectedVoiceTeardownError,
  normalizeVoiceErrorMessage,
  roundRate,
} from './voiceRuntimeUtils.mjs';
import { buildUseVoiceHookActionRuntimeControllerOptions } from './voiceHookControllerOptions.mjs';
import { buildUseVoiceHookActionCoreRuntime } from './voiceHookActionCoreRuntimeShape.mjs';

export function buildUseVoiceHookActionRuntimeInput({
  socket = null,
  userId = null,
  voiceState = {},
  voiceRefs = {},
  emitAsyncFn,
  setVoiceChannelIdFn,
  setVoiceChannelParticipantsFn,
  applyNoiseSuppressionRoutingFn,
  coreRuntime = {},
} = {}) {
  return buildUseVoiceHookActionRuntimeControllerOptions({
    socket,
    userId,
    state: voiceState,
    refs: voiceRefs,
    emitAsyncFn,
    clearVoiceKeyFn: clearVoiceKey,
    setVoiceChannelIdFn,
    setVoiceChannelParticipantsFn,
    recordLaneDiagnosticFn: recordLaneDiagnostic,
    isExpectedVoiceTeardownErrorFn: isExpectedVoiceTeardownError,
    normalizeVoiceErrorMessageFn: normalizeVoiceErrorMessage,
    applyNoiseSuppressionRoutingFn,
    applyVoiceModeDependenciesFn: applyVoiceModeDependencies,
    persistVoiceProcessingModeFn: persistVoiceProcessingMode,
    persistNoiseSuppressionEnabledFn: persistNoiseSuppressionEnabled,
    isUltraLowLatencyModeFn: isUltraLowLatencyMode,
    roundRateFn: roundRate,
    coreRuntime: buildUseVoiceHookActionCoreRuntime(coreRuntime),
  });
}
