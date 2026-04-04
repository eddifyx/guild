import {
  createVoiceSocketRuntimeHandlers,
  registerVoiceSocketRuntimeSubscriptions,
} from './voiceSocketRuntime.mjs';
import {
  startVoiceConsumerQualityRuntime,
  startVoiceDiagnosticsStatsRuntime,
} from './voiceDiagnosticsRuntime.mjs';
import { startVoiceScreenShareStatsRuntime } from './voiceScreenShareStatsRuntime.mjs';

export function registerVoiceSocketEffect({
  socket = null,
  currentUserId = null,
  producerUserMapRef = { current: new Map() },
  rememberUsersFn = () => {},
  getCurrentChannelIdFn = () => null,
  getUntrustedVoiceParticipantsFn = () => [],
  buildVoiceTrustErrorFn = () => null,
  setJoinErrorFn = () => {},
  setVoiceE2EFn = () => {},
  setE2EWarningFn = () => {},
  leaveChannelFn = () => {},
  syncVoiceParticipantsFn = async () => {},
  syncVoiceE2EStateFn = async () => {},
  handleUnexpectedVoiceSessionEndFn = async () => {},
  cleanupRemoteProducerFn = () => {},
  consumeProducerFn = async () => {},
  isExpectedVoiceTeardownErrorFn = () => false,
  setPeersFn = () => {},
  resetVoiceSessionFn = async () => {},
  getParticipantIdsFn = () => [],
  updateVoiceDiagnosticsFn = () => {},
} = {}) {
  if (!socket) {
    return () => {};
  }

  const handlers = createVoiceSocketRuntimeHandlers({
    currentUserId,
    getCurrentChannelId: getCurrentChannelIdFn,
    rememberUsers: rememberUsersFn,
    getUntrustedVoiceParticipants: getUntrustedVoiceParticipantsFn,
    buildVoiceTrustError: buildVoiceTrustErrorFn,
    setJoinError: setJoinErrorFn,
    setVoiceE2E: setVoiceE2EFn,
    setE2EWarning: setE2EWarningFn,
    leaveChannel: leaveChannelFn,
    syncVoiceParticipants: syncVoiceParticipantsFn,
    syncVoiceE2EState: syncVoiceE2EStateFn,
    handleUnexpectedVoiceSessionEnd: handleUnexpectedVoiceSessionEndFn,
    cleanupRemoteProducer: cleanupRemoteProducerFn,
    consumeProducer: consumeProducerFn,
    isExpectedVoiceTeardownError: isExpectedVoiceTeardownErrorFn,
    setPeers: setPeersFn,
    resetVoiceSession: resetVoiceSessionFn,
    getParticipantIds: getParticipantIdsFn,
    updateVoiceDiagnostics: updateVoiceDiagnosticsFn,
  });

  return registerVoiceSocketRuntimeSubscriptions(socket, {
    ...handlers,
    handleProducerClosed: (payload) => handlers.handleProducerClosed({
      ...payload,
      getProducerUserEntries: () => producerUserMapRef.current.entries(),
    }),
  });
}

export function registerVoiceKeyUpdatedEffect({
  windowObject = globalThis.window,
  getCurrentChannelIdFn = () => null,
  getParticipantIdsFn = () => [],
  setJoinErrorFn = () => {},
  setVoiceE2EFn = () => {},
  setE2EWarningFn = () => {},
  updateVoiceDiagnosticsFn = () => {},
  resumeVoiceMediaAfterKeyUpdateFn = async () => ({ resumed: false }),
} = {}) {
  const { handleVoiceKeyUpdated } = createVoiceSocketRuntimeHandlers({
    getCurrentChannelId: getCurrentChannelIdFn,
    getParticipantIds: getParticipantIdsFn,
    setJoinError: setJoinErrorFn,
    setVoiceE2E: setVoiceE2EFn,
    setE2EWarning: setE2EWarningFn,
    updateVoiceDiagnostics: updateVoiceDiagnosticsFn,
    resumeVoiceMediaAfterKeyUpdate: resumeVoiceMediaAfterKeyUpdateFn,
  });

  windowObject?.addEventListener?.('voice-key-updated', handleVoiceKeyUpdated);
  return () => {
    windowObject?.removeEventListener?.('voice-key-updated', handleVoiceKeyUpdated);
  };
}

export function createVoiceUnmountCleanup({
  refs = {},
  leaveChannelFn = () => {},
  clearTimeoutFn = clearTimeout,
} = {}) {
  const {
    pendingLiveReconfigureRef = { current: null },
    channelIdRef = { current: null },
  } = refs;

  return () => {
    if (pendingLiveReconfigureRef.current) {
      clearTimeoutFn(pendingLiveReconfigureRef.current);
      pendingLiveReconfigureRef.current = null;
    }
    if (channelIdRef.current) {
      leaveChannelFn();
    }
  };
}

export function registerVoiceAppleSupportEffect({
  prefersAppleSystemVoiceIsolationFn = () => false,
  electronAPI = null,
  appleVoiceAvailableRef = { current: true },
} = {}) {
  if (!prefersAppleSystemVoiceIsolationFn() || !electronAPI?.isAppleVoiceCaptureSupported) {
    return undefined;
  }

  let cancelled = false;
  electronAPI.isAppleVoiceCaptureSupported()
    .then((supported) => {
      if (!cancelled) {
        appleVoiceAvailableRef.current = supported !== false;
      }
    })
    .catch(() => {});

  return () => {
    cancelled = true;
  };
}

export function registerVoiceDiagnosticsStatsEffect({
  channelId = null,
  refs = {},
  summarizeProducerStatsFn = () => ({}),
  summarizeConsumerStatsFn = () => ({}),
  updateVoiceDiagnosticsFn = () => {},
  isVoiceDiagnosticsEnabledFn = () => false,
  nowIsoFn = () => new Date().toISOString(),
  setIntervalFn = globalThis.setInterval,
  clearIntervalFn = globalThis.clearInterval,
} = {}) {
  if (!isVoiceDiagnosticsEnabledFn() || !channelId) {
    return undefined;
  }

  return startVoiceDiagnosticsStatsRuntime({
    refs,
    summarizeProducerStatsFn,
    summarizeConsumerStatsFn,
    updateVoiceDiagnosticsFn,
    nowIsoFn,
    setIntervalFn,
    clearIntervalFn,
  });
}

export function registerVoiceConsumerQualityEffect({
  channelId = null,
  socket = null,
  refs = {},
  summarizeConsumerStatsFn = () => ({}),
  getBitrateBpsFn = (value) => value,
  setIntervalFn = globalThis.setInterval,
  clearIntervalFn = globalThis.clearInterval,
} = {}) {
  if (!socket || !channelId) {
    return undefined;
  }

  return startVoiceConsumerQualityRuntime({
    channelId,
    socket,
    refs,
    summarizeConsumerStatsFn,
    getBitrateBpsFn,
    setIntervalFn,
    clearIntervalFn,
  });
}

export function syncVoiceScreenShareDiagnosticsEffect({
  screenShareDiagnostics = null,
  isVoiceDiagnosticsEnabledFn = () => false,
  updateVoiceDiagnosticsFn = () => {},
} = {}) {
  if (!isVoiceDiagnosticsEnabledFn()) {
    return false;
  }

  updateVoiceDiagnosticsFn((prev) => ({
    ...prev,
    screenShare: screenShareDiagnostics,
  }));
  return true;
}

export function registerVoiceScreenShareStatsEffect({
  screenSharing = false,
  refs = {},
  setScreenShareDiagnosticsFn = () => {},
  maybeAdaptScreenShareProfileFn = async () => {},
  summarizeProducerStatsFn = () => ({}),
  summarizeTrackSnapshotFn = (value) => value,
  summarizeScreenShareProfileFn = (value) => value,
  summarizeScreenShareHardwareFn = (value) => value,
  screenShareProfiles = [],
  roundRateFn = (value) => value,
  performanceNowFn = () => globalThis.performance?.now?.() ?? Date.now(),
  nowIsoFn = () => new Date().toISOString(),
  setIntervalFn = globalThis.setInterval,
  clearIntervalFn = globalThis.clearInterval,
} = {}) {
  if (!screenSharing) {
    return undefined;
  }

  return startVoiceScreenShareStatsRuntime({
    refs,
    setScreenShareDiagnosticsFn,
    maybeAdaptScreenShareProfileFn,
    summarizeProducerStatsFn,
    summarizeTrackSnapshotFn,
    summarizeScreenShareProfileFn,
    summarizeScreenShareHardwareFn,
    screenShareProfiles,
    roundRateFn,
    performanceNowFn,
    nowIsoFn,
    setIntervalFn,
    clearIntervalFn,
  });
}
