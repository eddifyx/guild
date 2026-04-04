import {
  buildAudioConsumerDiagnostics,
  buildScreenConsumerDiagnostics,
} from './voiceConsumerDiagnostics.mjs';
import { mergeVoiceStatsSummary } from '../../utils/voiceDiagnostics.js';

function scheduleVoiceConsumerStatsProbe({
  audio = null,
  consumer = null,
  chId = null,
  producerId = null,
  producerUserId = null,
  summarizeConsumerStatsFn = (stats) => stats,
  debugLogFn = globalThis.window?.electronAPI?.debugLog?.bind?.(globalThis.window?.electronAPI) || null,
  setTimeoutFn = globalThis.setTimeout,
} = {}) {
  if (!audio || !consumer?.getStats || typeof setTimeoutFn !== 'function' || !debugLogFn) {
    return;
  }

  const emitSnapshot = async (label) => {
    let stats = null;
    try {
      stats = summarizeConsumerStatsFn(await consumer.getStats());
    } catch {}

    if (consumer?.rtpReceiver?.getStats) {
      try {
        const receiverStats = summarizeConsumerStatsFn(await consumer.rtpReceiver.getStats());
        stats = mergeVoiceStatsSummary(stats, receiverStats);
      } catch {}
    }

    try {
      debugLogFn('voice-consumer-stats', JSON.stringify({
        at: new Date().toISOString(),
        label,
        channelId: chId,
        producerId,
        producerUserId,
        element: {
          volume: audio.volume ?? null,
          muted: audio.muted ?? null,
          defaultMuted: audio.defaultMuted ?? null,
          paused: audio.paused ?? null,
          readyState: audio.readyState ?? null,
          sinkId: typeof audio.sinkId === 'string' ? audio.sinkId : null,
        },
        track: consumer.track
          ? {
              id: consumer.track.id || null,
              enabled: consumer.track.enabled ?? null,
              muted: consumer.track.muted ?? null,
              readyState: consumer.track.readyState || null,
              label: consumer.track.label || null,
            }
          : null,
        stats,
      }));
    } catch {}
  };

  setTimeoutFn(() => {
    void emitSnapshot('t+1000ms');
  }, 1000);
  setTimeoutFn(() => {
    void emitSnapshot('t+4000ms');
  }, 4000);
}

export function attachVoiceConsumerDecryption({
  consumer = null,
  data = {},
  codecMimeType = null,
  shouldAttachReceiverDecryption = false,
  attachReceiverDecryptionFn = () => {},
  nowFn = () => globalThis.performance?.now?.() ?? Date.now(),
  roundMsFn = (value) => value,
} = {}) {
  let decryptAttachMs = null;
  if (!shouldAttachReceiverDecryption) {
    return { decryptAttachMs };
  }

  const decryptStart = nowFn();
  const rtpReceiver = consumer?.rtpReceiver;
  if (!rtpReceiver) {
    throw new Error('Voice media receiver is missing secure transform support.');
  }
  const receiverDecryptionAttached = attachReceiverDecryptionFn(rtpReceiver, {
    kind: data.kind,
    codecMimeType,
  });
  if (receiverDecryptionAttached === false) {
    throw new Error('Voice media receiver is missing secure transform support.');
  }
  decryptAttachMs = roundMsFn(nowFn() - decryptStart);

  return { decryptAttachMs };
}

export async function resumeVoiceConsumer({
  consumer = null,
  requestServerResume = false,
  emitAsyncFn = async () => ({}),
  chId = null,
  producerId = null,
} = {}) {
  consumer?.resume?.();

  if (!requestServerResume) {
    return;
  }

  await emitAsyncFn('voice:resume-consumer', {
    channelId: chId,
    producerId,
  });
}

export async function attachScreenVoiceConsumer({
  chId = null,
  producerId = null,
  producerUserId = null,
  producerSource = 'screen-video',
  data = {},
  consumer = null,
  consumeStartedAt = null,
  consumeRequestMs = null,
  consumeTransportMs = null,
  decryptAttachMs = null,
  screenVideoBypassMode = null,
  bypassScreenVideoDecryption = false,
  codecMimeType = null,
  screenShareVideosMap = null,
  syncIncomingScreenSharesFn = () => {},
  updateVoiceDiagnosticsFn = () => {},
  recordLaneDiagnosticFn = () => {},
  summarizeTrackSnapshotFn = (value) => value,
  summarizeReceiverVideoCodecSupportFn = () => null,
  resumeVoiceConsumerFn = resumeVoiceConsumer,
  buildScreenConsumerDiagnosticsFn = buildScreenConsumerDiagnostics,
  mediaStreamCtor = globalThis.MediaStream,
  emitAsyncFn = async () => ({}),
} = {}) {
  recordLaneDiagnosticFn('voice', 'consumer_ready', {
    channelId: chId,
    producerId,
    producerUserId,
    kind: data.kind,
    source: producerSource,
    paused: data.paused === true,
    e2eeMode: bypassScreenVideoDecryption ? screenVideoBypassMode : 'encrypted',
  });

  const stream = new mediaStreamCtor([consumer.track]);
  screenShareVideosMap?.set?.(producerId, { userId: producerUserId, stream });
  syncIncomingScreenSharesFn();
  updateVoiceDiagnosticsFn((prev) => ({
    ...prev,
    consumers: {
      ...prev.consumers,
      [producerId]: buildScreenConsumerDiagnosticsFn({
        previousConsumerDiagnostics: prev.consumers[producerId] || null,
        producerId,
        producerUserId,
        producerSource,
        consumeStartedAt,
        consumer,
        consumeRequestMs,
        consumeTransportMs,
        decryptAttachMs,
        screenVideoBypassMode,
        bypassScreenVideoDecryption,
        codecMimeType,
        summarizeTrackSnapshotFn,
        summarizeReceiverVideoCodecSupportFn,
      }),
    },
  }));

  await resumeVoiceConsumerFn({
    consumer,
    requestServerResume: data.paused !== false,
    emitAsyncFn,
    chId,
    producerId,
  });

  return { stream };
}

export async function attachAudioVoiceConsumer({
  chId = null,
  producerId = null,
  producerUserId = null,
  producerSource = 'microphone',
  data = {},
  consumer = null,
  deafened = false,
  consumeStartedAt = null,
  consumeRequestMs = null,
  consumeTransportMs = null,
  decryptAttachMs = null,
  voiceAudioBypassMode = null,
  bypassVoiceAudioDecryption = false,
  screenVideoBypassMode = null,
  bypassScreenVideoDecryption = false,
  codecMimeType = null,
  audioElementsMap = null,
  mountRemoteAudioElementFn = () => {},
  applyVoiceOutputDeviceFn = async () => {},
  readStoredVoiceOutputDeviceIdFn = () => null,
  setUserAudioEntryFn = () => {},
  recordLaneDiagnosticFn = () => {},
  readStoredUserVolumeFn = () => 1,
  resumeVoiceConsumerFn = resumeVoiceConsumer,
  attachVoiceConsumerPlaybackRuntimeFn = () => {},
  buildPlaybackErrorMessageFn = (error) => error?.message || '',
  updateVoiceDiagnosticsFn = () => {},
  summarizeTrackSnapshotFn = (value) => value,
  summarizeConsumerStatsFn = (stats) => stats,
  summarizeReceiverVideoCodecSupportFn = () => null,
  buildAudioConsumerDiagnosticsFn = buildAudioConsumerDiagnostics,
  mediaStreamCtor = globalThis.MediaStream,
  audioCtor = globalThis.Audio,
  nowFn = () => globalThis.performance?.now?.() ?? Date.now(),
  roundMsFn = (value) => value,
  emitAsyncFn = async () => ({}),
  debugLogFn = globalThis.window?.electronAPI?.debugLog?.bind?.(globalThis.window?.electronAPI) || null,
  setTimeoutFn = globalThis.setTimeout,
} = {}) {
  const audioElementStart = nowFn();
  const stream = new mediaStreamCtor([consumer.track]);
  const audio = new audioCtor();
  audio.srcObject = stream;
  audio.autoplay = true;
  audio.playsInline = true;
  audio.preload = 'auto';
  audio.muted = deafened;
  audio.defaultMuted = deafened;
  mountRemoteAudioElementFn(audio, producerId);

  await applyVoiceOutputDeviceFn(audio, readStoredVoiceOutputDeviceIdFn());

  audioElementsMap?.set?.(producerId, audio);
  setUserAudioEntryFn(producerUserId, producerId, audio);
  recordLaneDiagnosticFn('voice', 'consumer_ready', {
    channelId: chId,
    producerId,
    producerUserId,
    kind: data.kind,
    source: producerSource,
    paused: data.paused === true,
    e2eeMode: bypassVoiceAudioDecryption ? voiceAudioBypassMode : 'encrypted',
  });

  audio.volume = readStoredUserVolumeFn(producerUserId);

  await resumeVoiceConsumerFn({
    consumer,
    requestServerResume: data.paused !== false,
    emitAsyncFn,
    chId,
    producerId,
  });
  attachVoiceConsumerPlaybackRuntimeFn({
    audio,
    consumerTrack: consumer.track,
    chId,
    producerId,
    producerUserId,
    buildPlaybackErrorMessageFn,
    updateVoiceDiagnosticsFn,
    recordLaneDiagnosticFn,
  });
  scheduleVoiceConsumerStatsProbe({
    audio,
    consumer,
    chId,
    producerId,
    producerUserId,
    summarizeConsumerStatsFn,
    debugLogFn,
    setTimeoutFn,
  });
  const audioElementSetupMs = roundMsFn(nowFn() - audioElementStart);

  updateVoiceDiagnosticsFn((prev) => ({
    ...prev,
    consumers: {
      ...prev.consumers,
      [producerId]: buildAudioConsumerDiagnosticsFn({
        previousConsumerDiagnostics: prev.consumers[producerId] || null,
        producerId,
        producerUserId,
        producerSource,
        consumeStartedAt,
        consumer,
        consumeRequestMs,
        consumeTransportMs,
        decryptAttachMs,
        audioElementSetupMs,
        voiceAudioBypassMode,
        bypassVoiceAudioDecryption,
        screenVideoBypassMode,
        bypassScreenVideoDecryption,
        codecMimeType,
        summarizeTrackSnapshotFn,
        summarizeReceiverVideoCodecSupportFn,
      }),
    },
  }));

  return {
    audio,
    stream,
    audioElementSetupMs,
  };
}
