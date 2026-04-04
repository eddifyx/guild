import {
  attachAudioVoiceConsumer,
  attachScreenVoiceConsumer,
  attachVoiceConsumerDecryption,
  resumeVoiceConsumer,
} from './voiceConsumerAttachRuntime.mjs';
import {
  buildAudioConsumerDiagnostics,
  buildScreenConsumerDiagnostics,
} from './voiceConsumerDiagnostics.mjs';

export {
  attachAudioVoiceConsumer,
  attachScreenVoiceConsumer,
  attachVoiceConsumerDecryption,
  resumeVoiceConsumer,
  buildAudioConsumerDiagnostics,
  buildScreenConsumerDiagnostics,
};

export function analyzeVoiceConsumer({
  data = {},
  source = null,
  getPrimaryCodecMimeTypeFromRtpParametersFn = () => null,
  getExperimentalScreenVideoBypassModeFn = () => null,
  getVoiceAudioBypassModeFn = () => null,
} = {}) {
  const producerSource = source || (data.kind === 'video' ? 'screen-video' : 'microphone');
  const codecMimeType = getPrimaryCodecMimeTypeFromRtpParametersFn(data.rtpParameters);
  const screenVideoBypassMode = getExperimentalScreenVideoBypassModeFn({
    source: producerSource,
    codecMimeType,
  });
  const voiceAudioBypassMode = getVoiceAudioBypassModeFn({
    kind: data.kind,
    source: producerSource,
  });
  const bypassScreenVideoDecryption = Boolean(screenVideoBypassMode);
  const bypassVoiceAudioDecryption = Boolean(voiceAudioBypassMode);

  return {
    producerSource,
    codecMimeType,
    screenVideoBypassMode,
    voiceAudioBypassMode,
    bypassScreenVideoDecryption,
    bypassVoiceAudioDecryption,
    shouldAttachReceiverDecryption: !bypassScreenVideoDecryption && !bypassVoiceAudioDecryption,
  };
}

export async function consumeVoiceProducer({
  chId = null,
  producerId = null,
  producerUserId = null,
  source = null,
  currentUserId = null,
  refs = {},
  emitAsyncFn = async () => ({}),
  recordLaneDiagnosticFn = () => {},
  getPrimaryCodecMimeTypeFromRtpParametersFn = () => null,
  getExperimentalScreenVideoBypassModeFn = () => null,
  getVoiceAudioBypassModeFn = () => null,
  attachReceiverDecryptionFn = () => {},
  cleanupRemoteProducerFn = () => {},
  syncIncomingScreenSharesFn = () => {},
  updateVoiceDiagnosticsFn = () => {},
  summarizeTrackSnapshotFn = (value) => value,
  summarizeReceiverVideoCodecSupportFn = () => null,
  mountRemoteAudioElementFn = () => {},
  applyVoiceOutputDeviceFn = async () => {},
  readStoredVoiceOutputDeviceIdFn = () => null,
  setUserAudioEntryFn = () => {},
  readStoredUserVolumeFn = () => 1,
  attachVoiceConsumerPlaybackRuntimeFn = () => {},
  buildPlaybackErrorMessageFn = (error) => error?.message || '',
  mediaStreamCtor = globalThis.MediaStream,
  audioCtor = globalThis.Audio,
  roundMsFn = (value) => value,
  performanceNowFn = () => globalThis.performance?.now?.() ?? Date.now(),
  nowIsoFn = () => new Date().toISOString(),
} = {}) {
  if (!refs.deviceRef?.current || !refs.recvTransportRef?.current) return null;
  if (
    producerUserId !== null
    && producerUserId !== undefined
    && currentUserId !== null
    && currentUserId !== undefined
    && String(producerUserId) === String(currentUserId)
  ) {
    return null;
  }
  if (refs.consumersRef?.current?.has?.(producerId)) return null;

  recordLaneDiagnosticFn('voice', 'consume_requested', {
    channelId: chId,
    producerId,
    producerUserId,
    source: source || null,
  });

  const consumeStartedAt = nowIsoFn();
  const consumeRequestStart = performanceNowFn();
  const data = await emitAsyncFn('voice:consume', {
    channelId: chId,
    producerId,
    producerUserId,
    rtpCapabilities: refs.deviceRef.current.rtpCapabilities,
  });
  const consumeRequestMs = roundMsFn(performanceNowFn() - consumeRequestStart);
  const {
    producerSource,
    codecMimeType,
    screenVideoBypassMode,
    voiceAudioBypassMode,
    bypassScreenVideoDecryption,
    bypassVoiceAudioDecryption,
    shouldAttachReceiverDecryption,
  } = analyzeVoiceConsumer({
    data,
    source,
    getPrimaryCodecMimeTypeFromRtpParametersFn,
    getExperimentalScreenVideoBypassModeFn,
    getVoiceAudioBypassModeFn,
  });

  const consumeTransportStart = performanceNowFn();
  const consumer = await refs.recvTransportRef.current.consume({
    id: data.id,
    producerId: data.producerId,
    kind: data.kind,
    rtpParameters: data.rtpParameters,
  });
  const consumeTransportMs = roundMsFn(performanceNowFn() - consumeTransportStart);

  let decryptAttachMs = null;
  try {
    decryptAttachMs = attachVoiceConsumerDecryption({
      consumer,
      data,
      codecMimeType,
      shouldAttachReceiverDecryption,
      attachReceiverDecryptionFn,
      roundMsFn,
      nowFn: performanceNowFn,
    }).decryptAttachMs;
  } catch (e2eErr) {
    consumer.close();
    throw new Error('Voice chat is unavailable because end-to-end media decryption could not start.');
  }

  for (const [existingProducerId, meta] of refs.producerMetaRef.current.entries()) {
    if (existingProducerId === producerId) continue;
    if (meta.userId !== producerUserId || meta.source !== producerSource) continue;
    cleanupRemoteProducerFn(existingProducerId, { producerUserId, source: producerSource });
  }

  refs.consumersRef.current.set(producerId, consumer);
  refs.producerUserMapRef.current.set(producerId, producerUserId);
  refs.producerMetaRef.current.set(producerId, {
    userId: producerUserId,
    kind: data.kind,
    source: producerSource,
  });

  if (producerSource === 'screen-video') {
    await attachScreenVoiceConsumer({
      chId,
      producerId,
      producerUserId,
      producerSource,
      data,
      consumer,
      consumeStartedAt,
      consumeRequestMs,
      consumeTransportMs,
      decryptAttachMs,
      screenVideoBypassMode,
      bypassScreenVideoDecryption,
      codecMimeType,
      screenShareVideosMap: refs.screenShareVideosRef?.current,
      syncIncomingScreenSharesFn,
      updateVoiceDiagnosticsFn,
      recordLaneDiagnosticFn,
      summarizeTrackSnapshotFn,
      summarizeReceiverVideoCodecSupportFn,
      mediaStreamCtor,
      emitAsyncFn,
    });
    return {
      producerSource,
      consumer,
    };
  }

  await attachAudioVoiceConsumer({
    chId,
    producerId,
    producerUserId,
    producerSource,
    data,
    consumer,
    deafened: Boolean(refs.deafenedRef?.current),
    consumeStartedAt,
    consumeRequestMs,
    consumeTransportMs,
    decryptAttachMs,
    voiceAudioBypassMode,
    bypassVoiceAudioDecryption,
    screenVideoBypassMode,
    bypassScreenVideoDecryption,
    codecMimeType,
    audioElementsMap: refs.audioElementsRef?.current,
    mountRemoteAudioElementFn,
    applyVoiceOutputDeviceFn,
    readStoredVoiceOutputDeviceIdFn,
    setUserAudioEntryFn,
    recordLaneDiagnosticFn,
    readStoredUserVolumeFn,
    attachVoiceConsumerPlaybackRuntimeFn,
    buildPlaybackErrorMessageFn,
    updateVoiceDiagnosticsFn,
    summarizeTrackSnapshotFn,
    summarizeReceiverVideoCodecSupportFn,
    mediaStreamCtor,
    audioCtor,
    roundMsFn,
    nowFn: performanceNowFn,
    emitAsyncFn,
  });

  return {
    producerSource,
    consumer,
  };
}
