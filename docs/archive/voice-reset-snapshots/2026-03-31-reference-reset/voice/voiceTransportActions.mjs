import { buildVoiceConsumeProducerOptions } from './voiceControllerBindings.mjs';
import { consumeVoiceProducer } from './voiceConsumerFlow.mjs';
import { cleanupVoiceScreenShareSession } from './voiceScreenShareFlow.mjs';
import {
  createVoiceRecvTransportSession,
  createVoiceSendTransportSession,
  getOrCreateVoiceScreenSendTransport,
} from './voiceTransportSessionFlow.mjs';

export function createVoiceTransportActions({
  refs = {},
  runtime = {},
  constants = {},
  currentUserId = null,
} = {}) {
  const {
    emitAsyncFn = async () => ({}),
    recordLaneDiagnosticFn = () => {},
    socket = null,
    resetScreenShareAdaptationFn = () => {},
    getCurrentChannelIdFn = () => null,
    playStreamStopChimeFn = () => {},
    setScreenSharingFn = () => {},
    setScreenShareStreamFn = () => {},
    setScreenShareErrorFn = () => {},
    setScreenShareDiagnosticsFn = () => {},
    cleanupRemoteProducerFn = () => {},
    syncIncomingScreenSharesFn = () => {},
    updateVoiceDiagnosticsFn = () => {},
    getPrimaryCodecMimeTypeFromRtpParametersFn = () => null,
    getExperimentalScreenVideoBypassModeFn = () => null,
    getVoiceAudioBypassModeFn = () => null,
    attachReceiverDecryptionFn = () => {},
    summarizeTrackSnapshotFn = (value) => value,
    summarizeReceiverVideoCodecSupportFn = () => null,
    mountRemoteAudioElementFn = () => {},
    applyVoiceOutputDeviceFn = async () => {},
    readStoredVoiceOutputDeviceIdFn = () => null,
    setUserAudioEntryFn = () => {},
    readStoredUserVolumeFn = () => 1,
    attachVoiceConsumerPlaybackRuntimeFn = () => {},
    buildPlaybackErrorMessageFn = (error) => error?.message || '',
    mediaStreamCtor,
    audioCtor,
    roundMsFn = (value) => value,
    performanceNowFn = () => globalThis.performance?.now?.() ?? Date.now(),
    nowIsoFn = () => new Date().toISOString(),
    insertableStreamsSupported = false,
    createClientVoiceSendTransportFn,
    createClientVoiceRecvTransportFn,
  } = runtime;

  const {
    voiceSafeMode = false,
    disableVoiceInsertableStreams = false,
  } = constants;

  async function createSendTransport(chId, purpose = 'voice') {
    return createVoiceSendTransportSession({
      chId,
      purpose,
      refs,
      emitAsyncFn,
      recordLaneDiagnosticFn,
      voiceSafeMode,
      disableVoiceInsertableStreams,
      insertableStreamsSupported,
      createClientVoiceSendTransportFn,
    });
  }

  async function getOrCreateScreenSendTransport(chId) {
    return getOrCreateVoiceScreenSendTransport({
      chId,
      refs: {
        screenSendTransportRef: refs.screenSendTransportRef,
      },
      createVoiceSendTransportSessionFn: ({ chId: nextChannelId, purpose }) => (
        createSendTransport(nextChannelId, purpose)
      ),
    });
  }

  async function cleanupScreenShareSession({
    emitShareState = false,
    playStopChime = false,
    clearError = true,
  } = {}) {
    return cleanupVoiceScreenShareSession({
      refs: {
        screenShareAudioProducerRef: refs.screenShareAudioProducerRef,
        screenShareProducerRef: refs.screenShareProducerRef,
        screenShareStreamRef: refs.screenShareStreamRef,
        screenSendTransportRef: refs.screenSendTransportRef,
        screenShareStatsRef: refs.screenShareStatsRef,
      },
      resetScreenShareAdaptationFn,
      setScreenSharingFn,
      setScreenShareStreamFn,
      setScreenShareErrorFn,
      setScreenShareDiagnosticsFn,
      socket,
      channelId: getCurrentChannelIdFn(),
      emitShareState,
      playStopChime,
      playStreamStopChimeFn,
      clearError,
    });
  }

  async function createRecvTransport(chId) {
    return createVoiceRecvTransportSession({
      chId,
      refs: {
        deviceRef: refs.deviceRef,
        recvTransportRef: refs.recvTransportRef,
      },
      emitAsyncFn,
      recordLaneDiagnosticFn,
      voiceSafeMode,
      disableVoiceInsertableStreams,
      insertableStreamsSupported,
      createClientVoiceRecvTransportFn,
    });
  }

  async function consumeProducer(chId, producerId, producerUserId, source = null) {
    return consumeVoiceProducer(buildVoiceConsumeProducerOptions({
      chId,
      producerId,
      producerUserId,
      source,
      currentUserId,
      refs: {
        deviceRef: refs.deviceRef,
        recvTransportRef: refs.recvTransportRef,
        consumersRef: refs.consumersRef,
        producerUserMapRef: refs.producerUserMapRef,
        producerMetaRef: refs.producerMetaRef,
        screenShareVideosRef: refs.screenShareVideosRef,
        audioElementsRef: refs.audioElementsRef,
        deafenedRef: refs.deafenedRef,
      },
      runtime: {
        emitAsyncFn,
        recordLaneDiagnosticFn,
        getPrimaryCodecMimeTypeFromRtpParametersFn,
        getExperimentalScreenVideoBypassModeFn,
        getVoiceAudioBypassModeFn,
        attachReceiverDecryptionFn,
        cleanupRemoteProducerFn,
        syncIncomingScreenSharesFn,
        updateVoiceDiagnosticsFn,
        summarizeTrackSnapshotFn,
        summarizeReceiverVideoCodecSupportFn,
        mountRemoteAudioElementFn,
        applyVoiceOutputDeviceFn,
        readStoredVoiceOutputDeviceIdFn,
        setUserAudioEntryFn,
        readStoredUserVolumeFn,
        attachVoiceConsumerPlaybackRuntimeFn,
        buildPlaybackErrorMessageFn,
        mediaStreamCtor,
        audioCtor,
        roundMsFn,
        performanceNowFn,
        nowIsoFn,
      },
    }));
  }

  return {
    createSendTransport,
    getOrCreateScreenSendTransport,
    cleanupScreenShareSession,
    createRecvTransport,
    consumeProducer,
  };
}
