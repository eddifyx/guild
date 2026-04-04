import { Device } from 'mediasoup-client';
import { buildUseVoiceHookActionSessionOptions } from './voiceHookActionRuntimeBuilders.mjs';
import { buildUseVoiceHookActionSessionCoreRuntimeOptions } from './voiceHookActionSessionCoreRuntimeOptions.mjs';
import { buildUseVoiceHookActionSessionEnvironment } from './voiceHookActionSessionEnvironment.mjs';
import { buildUseVoiceHookActionSessionStateOptions } from './voiceHookActionSessionStateOptions.mjs';

export function buildUseVoiceHookActionSessionControllerOptions({
  socket = null,
  state = {},
  refs = {},
  emitAsyncFn,
  clearVoiceKeyFn,
  setVoiceChannelIdFn,
  setVoiceChannelParticipantsFn,
  recordLaneDiagnosticFn,
  isExpectedVoiceTeardownErrorFn,
  normalizeVoiceErrorMessageFn,
  coreRuntime = {},
} = {}) {
  const stateOptions = buildUseVoiceHookActionSessionStateOptions({
    state,
    refs,
    setVoiceChannelIdFn,
  });
  const coreRuntimeOptions = buildUseVoiceHookActionSessionCoreRuntimeOptions({
    socket,
    emitAsyncFn,
    updateVoiceDiagnosticsFn: stateOptions.updateVoiceDiagnosticsFn,
    coreRuntime,
  });
  const environment = buildUseVoiceHookActionSessionEnvironment();

  return buildUseVoiceHookActionSessionOptions({
    socket,
    state,
    refs,
    emitAsyncFn,
    clearVoiceKeyFn,
    setVoiceChannelParticipantsFn,
    recordLaneDiagnosticFn,
    deviceCtor: Device,
    isExpectedVoiceTeardownErrorFn,
    normalizeVoiceErrorMessageFn,
    ...stateOptions,
    ...coreRuntimeOptions,
    ...environment,
  });
}
