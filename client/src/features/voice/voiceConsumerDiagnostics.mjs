export function buildScreenConsumerDiagnostics({
  previousConsumerDiagnostics = null,
  producerId = null,
  producerUserId = null,
  producerSource = 'screen-video',
  consumeStartedAt = null,
  consumer = null,
  consumeRequestMs = null,
  consumeTransportMs = null,
  decryptAttachMs = null,
  screenVideoBypassMode = null,
  bypassScreenVideoDecryption = false,
  codecMimeType = null,
  summarizeTrackSnapshotFn = (value) => value,
  summarizeReceiverVideoCodecSupportFn = () => null,
} = {}) {
  return {
    producerUserId,
    source: producerSource,
    startedAt: consumeStartedAt,
    paused: consumer?.paused,
    track: summarizeTrackSnapshotFn(consumer?.track || null),
    timingsMs: {
      consumeRequest: consumeRequestMs,
      transportSetup: consumeTransportMs,
      decryptAttach: decryptAttachMs,
    },
    e2eeMode: bypassScreenVideoDecryption ? screenVideoBypassMode : 'encrypted',
    signaledCodecMimeType: codecMimeType || null,
    receiverCodecSupport: summarizeReceiverVideoCodecSupportFn(),
    stats: previousConsumerDiagnostics?.stats || null,
  };
}

export function buildAudioConsumerDiagnostics({
  previousConsumerDiagnostics = null,
  producerId = null,
  producerUserId = null,
  producerSource = 'microphone',
  consumeStartedAt = null,
  consumer = null,
  consumeRequestMs = null,
  consumeTransportMs = null,
  decryptAttachMs = null,
  audioElementSetupMs = null,
  voiceAudioBypassMode = null,
  bypassVoiceAudioDecryption = false,
  screenVideoBypassMode = null,
  bypassScreenVideoDecryption = false,
  codecMimeType = null,
  summarizeTrackSnapshotFn = (value) => value,
  summarizeReceiverVideoCodecSupportFn = () => null,
} = {}) {
  return {
    producerUserId,
    source: producerSource,
    startedAt: consumeStartedAt,
    paused: consumer?.paused,
    track: summarizeTrackSnapshotFn(consumer?.track || null),
    timingsMs: {
      consumeRequest: consumeRequestMs,
      transportSetup: consumeTransportMs,
      decryptAttach: decryptAttachMs,
      audioElementSetup: audioElementSetupMs,
    },
    e2eeMode: bypassVoiceAudioDecryption
      ? voiceAudioBypassMode
      : (bypassScreenVideoDecryption ? screenVideoBypassMode : 'encrypted'),
    signaledCodecMimeType: codecMimeType || null,
    receiverCodecSupport: summarizeReceiverVideoCodecSupportFn(),
    playback: previousConsumerDiagnostics?.playback || {
      state: 'pending',
      via: 'initial',
      startedAt: null,
      error: null,
    },
    stats: previousConsumerDiagnostics?.stats || null,
  };
}
