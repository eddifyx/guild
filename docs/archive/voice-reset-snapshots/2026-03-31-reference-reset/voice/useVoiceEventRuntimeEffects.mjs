import { useEffect } from 'react';

import {
  createVoiceUnmountCleanup,
  registerVoiceAppleSupportEffect,
  registerVoiceKeyUpdatedEffect,
  registerVoiceSocketEffect,
} from './voiceRuntimeEffects.mjs';

export function useVoiceEventRuntimeEffects({
  refs = {},
  runtime = {},
} = {}) {
  const {
    channelIdRef = { current: null },
    appleVoiceAvailableRef = { current: true },
    producerUserMapRef = { current: new Map() },
    participantIdsRef = { current: [] },
    pendingLiveReconfigureRef = { current: null },
    leaveChannelRef = { current: null },
  } = refs;

  const {
    socket = null,
    currentUserId = null,
    rememberUsersFn = () => {},
    getUntrustedVoiceParticipantsFn = () => [],
    buildVoiceTrustErrorFn = () => null,
    setJoinErrorFn = () => {},
    setVoiceE2EFn = () => {},
    setE2EWarningFn = () => {},
    syncVoiceParticipantsFn = async () => {},
    syncVoiceE2EStateFn = async () => {},
    handleUnexpectedVoiceSessionEndFn = async () => {},
    cleanupRemoteProducerFn = () => {},
    consumeProducerFn = async () => {},
    resumeVoiceMediaAfterKeyUpdateFn = async () => ({ resumed: false }),
    isExpectedVoiceTeardownErrorFn = () => false,
    setPeersFn = () => {},
    resetVoiceSessionFn = async () => {},
    updateVoiceDiagnosticsFn = () => {},
    prefersAppleSystemVoiceIsolationFn = () => false,
    electronAPI = null,
    clearTimeoutFn = clearTimeout,
  } = runtime;

  useEffect(() => {
    return registerVoiceAppleSupportEffect({
      prefersAppleSystemVoiceIsolationFn,
      electronAPI,
      appleVoiceAvailableRef,
    });
  }, [appleVoiceAvailableRef, electronAPI, prefersAppleSystemVoiceIsolationFn]);

  useEffect(() => {
    return registerVoiceSocketEffect({
      socket,
      currentUserId,
      producerUserMapRef,
      rememberUsersFn,
      getCurrentChannelIdFn: () => channelIdRef.current,
      getUntrustedVoiceParticipantsFn,
      buildVoiceTrustErrorFn,
      setJoinErrorFn,
      setVoiceE2EFn,
      setE2EWarningFn,
      leaveChannelFn: () => leaveChannelRef.current?.(),
      syncVoiceParticipantsFn,
      syncVoiceE2EStateFn,
      handleUnexpectedVoiceSessionEndFn,
      cleanupRemoteProducerFn,
      consumeProducerFn,
      resumeVoiceMediaAfterKeyUpdateFn,
      isExpectedVoiceTeardownErrorFn,
      setPeersFn,
      resetVoiceSessionFn,
      getParticipantIdsFn: () => participantIdsRef.current,
      updateVoiceDiagnosticsFn,
    });
  }, [
    socket,
    currentUserId,
    producerUserMapRef,
    rememberUsersFn,
    channelIdRef,
    getUntrustedVoiceParticipantsFn,
    buildVoiceTrustErrorFn,
    setJoinErrorFn,
    setVoiceE2EFn,
    setE2EWarningFn,
    leaveChannelRef,
    syncVoiceParticipantsFn,
    syncVoiceE2EStateFn,
    handleUnexpectedVoiceSessionEndFn,
    cleanupRemoteProducerFn,
    consumeProducerFn,
    resumeVoiceMediaAfterKeyUpdateFn,
    isExpectedVoiceTeardownErrorFn,
    setPeersFn,
    resetVoiceSessionFn,
    participantIdsRef,
    updateVoiceDiagnosticsFn,
  ]);

  useEffect(() => {
    return registerVoiceKeyUpdatedEffect({
      windowObject: globalThis.window,
      getCurrentChannelIdFn: () => channelIdRef.current,
      getParticipantIdsFn: () => participantIdsRef.current,
      setJoinErrorFn,
      setVoiceE2EFn,
      setE2EWarningFn,
      updateVoiceDiagnosticsFn,
      resumeVoiceMediaAfterKeyUpdateFn,
    });
  }, [
    channelIdRef,
    participantIdsRef,
    setJoinErrorFn,
    setVoiceE2EFn,
    setE2EWarningFn,
    updateVoiceDiagnosticsFn,
    resumeVoiceMediaAfterKeyUpdateFn,
  ]);

  useEffect(() => {
    return createVoiceUnmountCleanup({
      refs: {
        pendingLiveReconfigureRef,
        channelIdRef,
      },
      leaveChannelFn: () => leaveChannelRef.current?.(),
      clearTimeoutFn,
    });
  }, [pendingLiveReconfigureRef, channelIdRef, leaveChannelRef, clearTimeoutFn]);
}
