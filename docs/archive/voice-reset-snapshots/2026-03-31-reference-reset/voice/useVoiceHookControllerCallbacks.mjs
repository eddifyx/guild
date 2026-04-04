import { useCallback } from 'react';

import {
  createVoiceEmitAsync,
  VOICE_SOCKET_ACK_TIMEOUT_MS,
} from './voiceSocketRuntime.mjs';
import {
  applyNoiseSuppressionRouting as applyVoiceNoiseSuppressionRouting,
} from './voiceRuntimeUtils.mjs';

export function useVoiceHookControllerCallbacks({
  socket = null,
  noiseSuppressionRoutingRef,
} = {}) {
  const applyNoiseSuppressionRoutingTo = useCallback((enabled) => (
    applyVoiceNoiseSuppressionRouting(noiseSuppressionRoutingRef.current, enabled)
  ), [noiseSuppressionRoutingRef]);

  const emitAsync = useCallback(createVoiceEmitAsync({
    socket,
    ackTimeoutMs: VOICE_SOCKET_ACK_TIMEOUT_MS,
  }), [socket]);

  return {
    applyNoiseSuppressionRoutingTo,
    emitAsync,
  };
}
