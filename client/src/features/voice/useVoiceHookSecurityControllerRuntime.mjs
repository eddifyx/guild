import {
  generateVoiceKey,
  getVoiceKey,
  setVoiceKey,
  distributeVoiceKey,
  isInsertableStreamsSupported,
  setVoiceChannelId,
  setVoiceChannelParticipants,
  waitForVoiceKey,
} from '../../crypto/voiceEncryption.js';
import { isE2EInitialized } from '../../crypto/sessionManager.js';
import { useVoiceSecurityActionController } from './useVoiceSecurityActionController.mjs';
import {
  buildVoiceSecurityActionRuntime,
  buildVoiceSecurityActionControllerOptions,
} from './voiceHookBindings.mjs';
import { getVoiceAudioBypassMode } from './voiceRuntimeUtils.mjs';
import { VOICE_RECOVERY_RUNTIME } from './voiceRecoveryConfig.mjs';

const {
  voiceSafeMode: VOICE_SAFE_MODE,
  disableVoiceInsertableStreams: VOICE_RECOVERY_DISABLE_VOICE_INSERTABLE_STREAMS,
} = VOICE_RECOVERY_RUNTIME;

async function flushPendingControlMessagesNowRuntime() {
  const { flushPendingControlMessagesNow } = await import('../../socket.js');
  return flushPendingControlMessagesNow();
}

export function useVoiceHookSecurityControllerRuntime({
  socket = null,
  userId = null,
  state = {},
  refs = {},
  runtime = {},
} = {}) {
  const { updateVoiceDiagnosticsFn = () => {} } = runtime;

  return useVoiceSecurityActionController(
    buildVoiceSecurityActionControllerOptions({
      userId,
      state,
      refs,
      runtime: buildVoiceSecurityActionRuntime({
        socket,
        getVoiceAudioBypassModeFn: (payload = {}) => (
          getVoiceAudioBypassMode({
            ...payload,
            disableVoiceInsertableStreams: VOICE_RECOVERY_DISABLE_VOICE_INSERTABLE_STREAMS,
          })
        ),
        getVoiceKeyFn: getVoiceKey,
        waitForVoiceKeyFn: waitForVoiceKey,
        generateVoiceKeyFn: generateVoiceKey,
        setVoiceKeyFn: setVoiceKey,
        clearVoiceKeyFn: runtime.clearVoiceKeyFn,
        distributeVoiceKeyFn: distributeVoiceKey,
        flushPendingControlMessagesNowFn: flushPendingControlMessagesNowRuntime,
        setVoiceChannelIdFn: setVoiceChannelId,
        setVoiceChannelParticipantsFn: setVoiceChannelParticipants,
        updateVoiceDiagnosticsFn,
        isE2EInitializedFn: isE2EInitialized,
        isInsertableStreamsSupportedFn: isInsertableStreamsSupported,
      }),
      constants: {
        voiceSafeMode: VOICE_SAFE_MODE,
      },
      deps: [socket, updateVoiceDiagnosticsFn, userId],
    })
  );
}
