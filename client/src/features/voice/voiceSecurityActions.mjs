import {
  syncVoiceE2EState as syncVoiceE2EStateInFlow,
} from './voiceE2EFlow.mjs';
import {
  syncVoiceParticipantsRuntime as syncVoiceParticipantsRuntimeInFlow,
} from './voiceParticipantRuntime.mjs';
import {
  ensureVoiceKeyForParticipants as ensureVoiceKeyForParticipantsInFlow,
  recoverVoiceKeyForParticipants as recoverVoiceKeyForParticipantsInFlow,
} from './voiceSecureFlow.mjs';
import {
  buildVoiceTrustError as buildVoiceTrustErrorMessage,
  getUntrustedVoiceParticipants as getUntrustedParticipants,
} from './voiceTrustState.mjs';

export function createVoiceSecurityActions({
  refs = {},
  setters = {},
  runtime = {},
  currentUserId = null,
  constants = {},
  deps = {},
} = {}) {
  const {
    channelIdRef = { current: null },
    participantIdsRef = { current: [] },
  } = refs;

  const {
    setVoiceE2EFn = () => {},
    setE2EWarningFn = () => {},
    setJoinErrorFn = () => {},
    setPeersFn = () => {},
  } = setters;

  const {
    socket = null,
    getVoiceAudioBypassModeFn = () => null,
    getVoiceKeyFn = () => null,
    waitForVoiceKeyFn = async () => null,
    generateVoiceKeyFn = async () => null,
    setVoiceKeyFn = () => {},
    clearVoiceKeyFn = () => {},
    distributeVoiceKeyFn = async () => {},
    flushPendingControlMessagesNowFn = () => {},
    setVoiceChannelIdFn = () => {},
    setVoiceChannelParticipantsFn = () => {},
    updateVoiceDiagnosticsFn = () => {},
    isE2EInitializedFn = () => true,
    isInsertableStreamsSupportedFn = () => true,
  } = runtime;

  const {
    voiceSafeMode = false,
  } = constants;

  const recoverVoiceKeyForParticipantsFlowFn =
    deps.recoverVoiceKeyForParticipantsFn || recoverVoiceKeyForParticipantsInFlow;
  const ensureVoiceKeyForParticipantsFlowFn =
    deps.ensureVoiceKeyForParticipantsFn || ensureVoiceKeyForParticipantsInFlow;
  const syncVoiceE2EStateFlowFn =
    deps.syncVoiceE2EStateFn || syncVoiceE2EStateInFlow;
  const syncVoiceParticipantsFlowFn =
    deps.syncVoiceParticipantsRuntimeFn || syncVoiceParticipantsRuntimeInFlow;
  const getUntrustedVoiceParticipantsFlowFn =
    deps.getUntrustedVoiceParticipantsFn || getUntrustedParticipants;
  const buildVoiceTrustErrorFlowFn =
    deps.buildVoiceTrustErrorFn || buildVoiceTrustErrorMessage;

  function ensureSecureMediaReady(feature) {
    if (feature === 'Voice chat' && voiceSafeMode) {
      return;
    }
    if (!isE2EInitializedFn()) {
      throw new Error(`${feature} is unavailable until end-to-end encryption is ready.`);
    }
    if (!isInsertableStreamsSupportedFn()) {
      throw new Error(`${feature} is unavailable because this device does not support secure media transforms.`);
    }
  }

  async function recoverVoiceKeyForParticipants(participantIds, {
    activeChannelId = channelIdRef.current,
    timeoutMs = 5000,
  } = {}) {
    return recoverVoiceKeyForParticipantsFlowFn(participantIds, {
      activeChannelId,
      timeoutMs,
      currentUserId,
      socket,
      getVoiceKeyFn,
      waitForVoiceKeyFn,
      generateVoiceKeyFn,
      setVoiceKeyFn,
      distributeVoiceKeyFn,
    });
  }

  async function ensureVoiceKeyForParticipants(participantIds, {
    activeChannelId = channelIdRef.current,
    feature = 'Voice chat',
    timeoutMs = 5000,
  } = {}) {
    return ensureVoiceKeyForParticipantsFlowFn(participantIds, {
      activeChannelId,
      feature,
      timeoutMs,
      currentUserId,
      currentParticipantIds: participantIdsRef.current,
      currentChannelId: channelIdRef.current,
      getVoiceKeyFn,
      waitForVoiceKeyFn,
      recoverVoiceKeyForParticipantsFn: recoverVoiceKeyForParticipants,
    });
  }

  async function syncVoiceE2EState(participantIds, {
    activeChannelId = channelIdRef.current,
    feature = 'Voice chat',
  } = {}) {
    return syncVoiceE2EStateFlowFn(participantIds, {
      activeChannelId,
      feature,
      currentUserId,
      currentChannelId: channelIdRef.current,
      voiceSafeMode,
      getVoiceAudioBypassModeFn,
      ensureVoiceKeyForParticipantsFn: ensureVoiceKeyForParticipants,
      getVoiceKeyFn,
      setVoiceE2EFn,
      setE2EWarningFn,
      setJoinErrorFn,
      updateVoiceDiagnosticsFn,
    });
  }

  function getUntrustedVoiceParticipants(participants) {
    return getUntrustedVoiceParticipantsFlowFn(participants, { currentUserId });
  }

  function buildVoiceTrustError(participants) {
    return buildVoiceTrustErrorFlowFn(participants, { currentUserId });
  }

  async function syncVoiceParticipants(participants, {
    channelId: activeChannelId = channelIdRef.current,
  } = {}) {
    await syncVoiceParticipantsFlowFn(participants, {
      activeChannelId,
      currentUserId,
      previousParticipantIds: participantIdsRef.current,
      socket,
      setParticipantIdsFn: (nextParticipantIds) => {
        participantIdsRef.current = nextParticipantIds;
      },
      setVoiceChannelIdFn,
      setVoiceChannelParticipantsFn,
      flushPendingControlMessagesNowFn,
      setPeersFn,
      getVoiceKeyFn,
      generateVoiceKeyFn,
      setVoiceKeyFn,
      clearVoiceKeyFn,
      distributeVoiceKeyFn,
    });
  }

  return {
    ensureSecureMediaReady,
    recoverVoiceKeyForParticipants,
    ensureVoiceKeyForParticipants,
    syncVoiceE2EState,
    getUntrustedVoiceParticipants,
    buildVoiceTrustError,
    syncVoiceParticipants,
  };
}
