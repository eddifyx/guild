import { getVoiceKey } from '../../crypto/voiceEncryption.js';
import { setVoiceChannelId as setVoiceChannelIdRuntime } from '../../crypto/voiceEncryption.js';
import { setVoiceChannelParticipants as setVoiceChannelParticipantsRuntime } from '../../crypto/voiceEncryption.js';
import { LANE_DIAGNOSTIC_EVENT_NAME, recordLaneDiagnostic } from '../../utils/laneDiagnostics.js';
import { useVoiceHookActionRuntimeController } from './useVoiceHookActionRuntimeController.mjs';
import { useVoiceHookControllerCallbacks } from './useVoiceHookControllerCallbacks.mjs';
import { useVoiceHookCoreRuntimeController } from './useVoiceHookCoreRuntimeController.mjs';
import { resumeVoiceMediaAfterKeyUpdateFlow } from './voiceKeyRecoveryFlow.mjs';
import {
  buildUseVoiceHookControllerRuntimeValue,
} from './voiceHookControllerRuntimeShapes.mjs';
import {
  buildUseVoiceHookActionRuntimeInput,
  buildUseVoiceHookCoreRuntimeInput,
} from './voiceHookControllerRuntimeInputs.mjs';
import { useCallback, useEffect } from 'react';

export function useVoiceHookControllerRuntime({
  socket = null,
  userId = null,
  voiceState = {},
  voiceRefs = {},
} = {}) {
  const {
    setVoiceChannelId: setVoiceChannelIdState,
    setVoiceChannelParticipants: setVoiceChannelParticipantsState,
    updateVoiceDiagnostics,
    setMuted,
  } = voiceState;
  const setVoiceChannelIdFn = typeof setVoiceChannelIdState === 'function'
    ? setVoiceChannelIdState
    : setVoiceChannelIdRuntime;
  const setVoiceChannelParticipantsFn = typeof setVoiceChannelParticipantsState === 'function'
    ? setVoiceChannelParticipantsState
    : setVoiceChannelParticipantsRuntime;

  const {
    applyNoiseSuppressionRoutingTo,
    emitAsync,
  } = useVoiceHookControllerCallbacks({
    socket,
    noiseSuppressionRoutingRef: voiceRefs.noiseSuppressionRoutingRef,
  });

  const coreController = useVoiceHookCoreRuntimeController(buildUseVoiceHookCoreRuntimeInput({
    socket,
    userId,
    voiceState,
    voiceRefs,
    updateVoiceDiagnosticsFn: updateVoiceDiagnostics,
    applyNoiseSuppressionRoutingFn: applyNoiseSuppressionRoutingTo,
    emitAsyncFn: emitAsync,
  }));

  const coreRuntime = {
    ...coreController,
    getCurrentVoiceKey: useCallback(() => getVoiceKey(), []),
    resumeVoiceMediaAfterKeyUpdate: useCallback(async ({ channelId } = {}) => {
      const pendingSecureVoiceJoin = voiceRefs.pendingSecureVoiceJoinRef?.current;
      const result = await resumeVoiceMediaAfterKeyUpdateFlow({
        channelId,
        refs: {
          channelIdRef: voiceRefs.channelIdRef,
          consumersRef: voiceRefs.consumersRef,
          producerMetaRef: voiceRefs.producerMetaRef,
          producerRef: voiceRefs.producerRef,
          liveCaptureRef: voiceRefs.liveCaptureRef,
          sendTransportRef: voiceRefs.sendTransportRef,
          voiceHealthProbeRetryCountRef: voiceRefs.voiceHealthProbeRetryCountRef,
          mutedRef: voiceRefs.mutedRef,
        },
        pendingSecureVoiceJoin,
        consumeProducerFn: coreController.consumeProducer,
        cleanupRemoteProducerFn: coreController.cleanupRemoteProducer,
        applyLiveCaptureToProducerFn: coreController.applyLiveCaptureToProducer,
        scheduleVoiceHealthProbeFn: coreController.scheduleVoiceHealthProbe,
        setMutedFn: setMuted,
        updateVoiceDiagnosticsFn: updateVoiceDiagnostics,
        recordLaneDiagnosticFn: recordLaneDiagnostic,
      });
      if (result.resumed && voiceRefs.pendingSecureVoiceJoinRef) {
        voiceRefs.pendingSecureVoiceJoinRef.current = null;
      }
      return result;
    }, [
      coreController.applyLiveCaptureToProducer,
      coreController.cleanupRemoteProducer,
      coreController.consumeProducer,
      coreController.scheduleVoiceHealthProbe,
      setMuted,
      updateVoiceDiagnostics,
      voiceRefs.channelIdRef,
      voiceRefs.consumersRef,
      voiceRefs.liveCaptureRef,
      voiceRefs.mutedRef,
      voiceRefs.pendingSecureVoiceJoinRef,
      voiceRefs.producerMetaRef,
      voiceRefs.producerRef,
      voiceRefs.sendTransportRef,
      voiceRefs.voiceHealthProbeRetryCountRef,
    ]),
  };

  useEffect(() => {
    const windowObj = globalThis.window;
    if (!windowObj?.addEventListener || !windowObj?.removeEventListener) return undefined;
    if (!windowObj?.electronAPI?.debugLog) return undefined;

    const handleLaneDiagnostic = (event) => {
      const entry = event?.detail;
      if (entry?.lane !== 'voice') return;

      try {
        windowObj.electronAPI.debugLog('voice', JSON.stringify({
          at: entry?.at || null,
          event: entry?.event || null,
          details: entry?.details || {},
        }));
      } catch {}
    };

    windowObj.addEventListener(LANE_DIAGNOSTIC_EVENT_NAME, handleLaneDiagnostic);
    return () => {
      windowObj.removeEventListener(LANE_DIAGNOSTIC_EVENT_NAME, handleLaneDiagnostic);
    };
  }, []);

  const actionController = useVoiceHookActionRuntimeController(buildUseVoiceHookActionRuntimeInput({
    socket,
    userId,
    voiceState,
    voiceRefs,
    emitAsyncFn: emitAsync,
    setVoiceChannelIdFn,
    setVoiceChannelParticipantsFn,
    applyNoiseSuppressionRoutingFn: applyNoiseSuppressionRoutingTo,
    coreRuntime,
  }));

  return buildUseVoiceHookControllerRuntimeValue({
    ...actionController,
    ...coreRuntime,
  });
}
