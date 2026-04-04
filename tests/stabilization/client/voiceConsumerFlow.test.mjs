import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeVoiceConsumer,
  attachAudioVoiceConsumer,
  attachScreenVoiceConsumer,
  attachVoiceConsumerDecryption,
  buildAudioConsumerDiagnostics,
  buildScreenConsumerDiagnostics,
  consumeVoiceProducer,
  resumeVoiceConsumer,
} from '../../../client/src/features/voice/voiceConsumerFlow.mjs';

test('voice consumer flow derives source, codec, and bypass flags from consume data', () => {
  const result = analyzeVoiceConsumer({
    data: {
      kind: 'audio',
      rtpParameters: { codecs: [{ mimeType: 'audio/opus' }] },
    },
    source: null,
    getPrimaryCodecMimeTypeFromRtpParametersFn: () => 'audio/opus',
    getExperimentalScreenVideoBypassModeFn: () => null,
    getVoiceAudioBypassModeFn: () => 'bypassed-voice-safe-mode',
  });

  assert.deepEqual(result, {
    producerSource: 'microphone',
    codecMimeType: 'audio/opus',
    screenVideoBypassMode: null,
    voiceAudioBypassMode: 'bypassed-voice-safe-mode',
    bypassScreenVideoDecryption: false,
    bypassVoiceAudioDecryption: true,
    shouldAttachReceiverDecryption: false,
  });
});

test('voice consumer flow attaches receiver decryption when required', () => {
  const calls = [];
  const result = attachVoiceConsumerDecryption({
    consumer: {
      rtpReceiver: { id: 'receiver-1' },
    },
    data: {
      kind: 'audio',
    },
    codecMimeType: 'audio/opus',
    shouldAttachReceiverDecryption: true,
    attachReceiverDecryptionFn: (...args) => calls.push(args),
    nowFn: (() => {
      let tick = 0;
      return () => (tick += 4);
    })(),
    roundMsFn: (value) => value,
  });

  assert.equal(result.decryptAttachMs, 4);
  assert.deepEqual(calls, [[
    { id: 'receiver-1' },
    { kind: 'audio', codecMimeType: 'audio/opus' },
  ]]);
});

test('voice consumer flow throws when secure decryption is required but no RTP receiver exists', () => {
  assert.throws(() => attachVoiceConsumerDecryption({
    consumer: {},
    data: { kind: 'audio' },
    codecMimeType: 'audio/opus',
    shouldAttachReceiverDecryption: true,
  }), /secure transform support/i);
});

test('voice consumer flow resumes the local consumer and optionally resumes the server consumer', async () => {
  const calls = [];
  let resumed = 0;

  await resumeVoiceConsumer({
    consumer: {
      resume() {
        resumed += 1;
      },
    },
    requestServerResume: true,
    emitAsyncFn: async (eventName, payload) => {
      calls.push([eventName, payload]);
    },
    chId: 'channel-1',
    producerId: 'producer-1',
  });

  assert.equal(resumed, 1);
  assert.deepEqual(calls, [[
    'voice:resume-consumer',
    { channelId: 'channel-1', producerId: 'producer-1' },
  ]]);
});

test('voice consumer flow builds stable screen diagnostics payloads', () => {
  const diagnostics = buildScreenConsumerDiagnostics({
    previousConsumerDiagnostics: { stats: { bitrate: 5 } },
    producerUserId: 'user-2',
    producerSource: 'screen-video',
    consumeStartedAt: '2026-03-25T12:00:00.000Z',
    consumer: {
      paused: false,
      track: { id: 'screen-track' },
    },
    consumeRequestMs: 3,
    consumeTransportMs: 4,
    decryptAttachMs: 5,
    screenVideoBypassMode: 'screen-bypass',
    bypassScreenVideoDecryption: true,
    codecMimeType: 'video/VP9',
    summarizeTrackSnapshotFn: (track) => track?.id || null,
    summarizeReceiverVideoCodecSupportFn: () => ({ vp9: true }),
  });

  assert.deepEqual(diagnostics, {
    producerUserId: 'user-2',
    source: 'screen-video',
    startedAt: '2026-03-25T12:00:00.000Z',
    paused: false,
    track: 'screen-track',
    timingsMs: {
      consumeRequest: 3,
      transportSetup: 4,
      decryptAttach: 5,
    },
    e2eeMode: 'screen-bypass',
    signaledCodecMimeType: 'video/VP9',
    receiverCodecSupport: { vp9: true },
    stats: { bitrate: 5 },
  });
});

test('voice consumer flow builds stable audio diagnostics payloads', () => {
  const diagnostics = buildAudioConsumerDiagnostics({
    previousConsumerDiagnostics: { stats: { bitrate: 9 } },
    producerUserId: 'user-3',
    producerSource: 'microphone',
    consumeStartedAt: '2026-03-25T12:00:00.000Z',
    consumer: {
      paused: true,
      track: { id: 'audio-track' },
    },
    consumeRequestMs: 1,
    consumeTransportMs: 2,
    decryptAttachMs: 3,
    audioElementSetupMs: 4,
    voiceAudioBypassMode: null,
    bypassVoiceAudioDecryption: false,
    screenVideoBypassMode: null,
    bypassScreenVideoDecryption: false,
    codecMimeType: 'audio/opus',
    summarizeTrackSnapshotFn: (track) => track?.id || null,
    summarizeReceiverVideoCodecSupportFn: () => ({ opus: true }),
  });

  assert.deepEqual(diagnostics, {
    producerUserId: 'user-3',
    source: 'microphone',
    startedAt: '2026-03-25T12:00:00.000Z',
    paused: true,
    track: 'audio-track',
    timingsMs: {
      consumeRequest: 1,
      transportSetup: 2,
      decryptAttach: 3,
      audioElementSetup: 4,
    },
    e2eeMode: 'encrypted',
    signaledCodecMimeType: 'audio/opus',
    receiverCodecSupport: { opus: true },
    playback: {
      state: 'pending',
      via: 'initial',
      startedAt: null,
      error: null,
    },
    stats: { bitrate: 9 },
  });
});

test('voice consumer flow attaches a screen consumer and updates diagnostics', async () => {
  let diagnostics = { consumers: {} };
  const screenShareVideos = new Map();
  const laneEvents = [];
  let resumed = 0;
  let synced = 0;

  await attachScreenVoiceConsumer({
    chId: 'channel-1',
    producerId: 'producer-screen',
    producerUserId: 'user-screen',
    producerSource: 'screen-video',
    data: { kind: 'video', paused: true },
    consumer: {
      paused: false,
      track: { id: 'track-screen' },
    },
    consumeStartedAt: '2026-03-25T12:00:00.000Z',
    consumeRequestMs: 2,
    consumeTransportMs: 3,
    decryptAttachMs: 4,
    screenVideoBypassMode: 'screen-bypass',
    bypassScreenVideoDecryption: true,
    codecMimeType: 'video/VP9',
    screenShareVideosMap: screenShareVideos,
    syncIncomingScreenSharesFn: () => { synced += 1; },
    updateVoiceDiagnosticsFn: (updater) => {
      diagnostics = updater(diagnostics);
    },
    recordLaneDiagnosticFn: (...args) => laneEvents.push(args),
    summarizeTrackSnapshotFn: (track) => track?.id || null,
    summarizeReceiverVideoCodecSupportFn: () => ({ vp9: true }),
    resumeVoiceConsumerFn: async () => { resumed += 1; },
    mediaStreamCtor: class {
      constructor(tracks) {
        this.tracks = tracks;
      }
    },
  });

  assert.equal(screenShareVideos.get('producer-screen').userId, 'user-screen');
  assert.equal(screenShareVideos.get('producer-screen').stream.tracks[0].id, 'track-screen');
  assert.equal(synced, 1);
  assert.equal(resumed, 1);
  assert.equal(laneEvents[0][1], 'consumer_ready');
  assert.equal(diagnostics.consumers['producer-screen'].e2eeMode, 'screen-bypass');
});

test('voice consumer flow attaches an audio consumer and updates diagnostics', async () => {
  let diagnostics = { consumers: {} };
  const laneEvents = [];
  const audioElements = new Map();
  const userAudioEntries = [];
  const playbackCalls = [];
  let resumed = 0;

  class FakeStream {
    constructor(tracks) {
      this.tracks = tracks;
    }
  }

  class FakeAudio {
    constructor() {
      this.autoplay = false;
      this.playsInline = false;
      this.preload = '';
      this.muted = false;
      this.defaultMuted = false;
      this.volume = 1;
      this.srcObject = null;
    }
  }

  const result = await attachAudioVoiceConsumer({
    chId: 'channel-2',
    producerId: 'producer-audio',
    producerUserId: 'user-audio',
    producerSource: 'microphone',
    data: { kind: 'audio', paused: true },
    consumer: {
      paused: true,
      track: { id: 'track-audio' },
    },
    deafened: true,
    consumeStartedAt: '2026-03-25T12:00:00.000Z',
    consumeRequestMs: 1,
    consumeTransportMs: 2,
    decryptAttachMs: 3,
    voiceAudioBypassMode: null,
    bypassVoiceAudioDecryption: false,
    screenVideoBypassMode: null,
    bypassScreenVideoDecryption: false,
    codecMimeType: 'audio/opus',
    audioElementsMap: audioElements,
    mountRemoteAudioElementFn: (audio, producerId) => {
      audio.mountedFor = producerId;
    },
    applyVoiceOutputDeviceFn: async (audio, deviceId) => {
      audio.outputDeviceId = deviceId;
    },
    readStoredVoiceOutputDeviceIdFn: () => 'speaker-1',
    setUserAudioEntryFn: (...args) => userAudioEntries.push(args),
    recordLaneDiagnosticFn: (...args) => laneEvents.push(args),
    readStoredUserVolumeFn: () => 0.42,
    resumeVoiceConsumerFn: async () => { resumed += 1; },
    attachVoiceConsumerPlaybackRuntimeFn: (payload) => playbackCalls.push(payload),
    buildPlaybackErrorMessageFn: (error) => error?.message || '',
    updateVoiceDiagnosticsFn: (updater) => {
      diagnostics = updater(diagnostics);
    },
    summarizeTrackSnapshotFn: (track) => track?.id || null,
    summarizeReceiverVideoCodecSupportFn: () => ({ opus: true }),
    mediaStreamCtor: FakeStream,
    audioCtor: FakeAudio,
    nowFn: (() => {
      let tick = 0;
      return () => (tick += 5);
    })(),
    roundMsFn: (value) => value,
  });

  assert.equal(audioElements.get('producer-audio').mountedFor, 'producer-audio');
  assert.equal(audioElements.get('producer-audio').outputDeviceId, 'speaker-1');
  assert.equal(audioElements.get('producer-audio').volume, 0.42);
  assert.equal(audioElements.get('producer-audio').muted, true);
  assert.deepEqual(userAudioEntries, [['user-audio', 'producer-audio', audioElements.get('producer-audio')]]);
  assert.equal(resumed, 1);
  assert.equal(playbackCalls.length, 1);
  assert.equal(result.audioElementSetupMs, 5);
  assert.equal(result.stream.tracks[0].id, 'track-audio');
  assert.equal(laneEvents[0][1], 'consumer_ready');
  assert.equal(diagnostics.consumers['producer-audio'].timingsMs.audioElementSetup, 5);
});

test('voice consumer flow skips consume requests for duplicates and the current user', async () => {
  const duplicateResult = await consumeVoiceProducer({
    chId: 'channel-1',
    producerId: 'producer-1',
    producerUserId: 'user-2',
    currentUserId: 'user-1',
    refs: {
      deviceRef: { current: { rtpCapabilities: {} } },
      recvTransportRef: { current: { consume: async () => ({}) } },
      consumersRef: { current: new Map([['producer-1', { id: 'existing' }]]) },
      producerUserMapRef: { current: new Map() },
      producerMetaRef: { current: new Map() },
      screenShareVideosRef: { current: new Map() },
      audioElementsRef: { current: new Map() },
      deafenedRef: { current: false },
    },
    emitAsyncFn: async () => {
      throw new Error('should-not-consume');
    },
  });

  const selfResult = await consumeVoiceProducer({
    chId: 'channel-1',
    producerId: 'producer-2',
    producerUserId: 'user-1',
    currentUserId: 'user-1',
    refs: {
      deviceRef: { current: { rtpCapabilities: {} } },
      recvTransportRef: { current: { consume: async () => ({}) } },
      consumersRef: { current: new Map() },
      producerUserMapRef: { current: new Map() },
      producerMetaRef: { current: new Map() },
      screenShareVideosRef: { current: new Map() },
      audioElementsRef: { current: new Map() },
      deafenedRef: { current: false },
    },
    emitAsyncFn: async () => {
      throw new Error('should-not-consume');
    },
  });

  const mixedTypeSelfResult = await consumeVoiceProducer({
    chId: 'channel-1',
    producerId: 'producer-3',
    producerUserId: 7,
    currentUserId: '7',
    refs: {
      deviceRef: { current: { rtpCapabilities: {} } },
      recvTransportRef: { current: { consume: async () => ({}) } },
      consumersRef: { current: new Map() },
      producerUserMapRef: { current: new Map() },
      producerMetaRef: { current: new Map() },
      screenShareVideosRef: { current: new Map() },
      audioElementsRef: { current: new Map() },
      deafenedRef: { current: false },
    },
    emitAsyncFn: async () => {
      throw new Error('should-not-consume');
    },
  });

  assert.equal(duplicateResult, null);
  assert.equal(selfResult, null);
  assert.equal(mixedTypeSelfResult, null);
});

test('voice consumer flow orchestrates a screen consumer and cleans up older matching producers', async () => {
  const cleanupCalls = [];
  const screenShareVideos = new Map();
  const producerMeta = new Map([
    ['old-producer', { userId: 'user-screen', source: 'screen-video' }],
  ]);
  const producerUserMap = new Map();
  const consumers = new Map();
  const laneEvents = [];
  let diagnostics = { consumers: {} };

  const result = await consumeVoiceProducer({
    chId: 'channel-2',
    producerId: 'producer-screen',
    producerUserId: 'user-screen',
    currentUserId: 'user-local',
    refs: {
      deviceRef: { current: { rtpCapabilities: { codecs: [] } } },
      recvTransportRef: {
        current: {
          async consume() {
            return {
              paused: false,
              track: { id: 'screen-track' },
              rtpReceiver: { id: 'receiver-1' },
            };
          },
        },
      },
      consumersRef: { current: consumers },
      producerUserMapRef: { current: producerUserMap },
      producerMetaRef: { current: producerMeta },
      screenShareVideosRef: { current: screenShareVideos },
      audioElementsRef: { current: new Map() },
      deafenedRef: { current: false },
    },
    emitAsyncFn: async (eventName) => {
      if (eventName === 'voice:consume') {
        return {
          id: 'consumer-1',
          producerId: 'producer-screen',
          kind: 'video',
          paused: true,
          rtpParameters: { codecs: [{ mimeType: 'video/VP9' }] },
        };
      }
      return {};
    },
    recordLaneDiagnosticFn: (...args) => laneEvents.push(args),
    getPrimaryCodecMimeTypeFromRtpParametersFn: () => 'video/VP9',
    getExperimentalScreenVideoBypassModeFn: () => null,
    getVoiceAudioBypassModeFn: () => null,
    attachReceiverDecryptionFn: () => {},
    cleanupRemoteProducerFn: (...args) => cleanupCalls.push(args),
    syncIncomingScreenSharesFn: () => {},
    updateVoiceDiagnosticsFn: (updater) => {
      diagnostics = updater(diagnostics);
    },
    summarizeTrackSnapshotFn: (track) => track?.id || null,
    summarizeReceiverVideoCodecSupportFn: () => ({ vp9: true }),
    mediaStreamCtor: class {
      constructor(tracks) {
        this.tracks = tracks;
      }
    },
    performanceNowFn: (() => {
      let tick = 0;
      return () => (tick += 5);
    })(),
    nowIsoFn: () => '2026-03-25T13:00:00.000Z',
    roundMsFn: (value) => value,
  });

  assert.equal(result.producerSource, 'screen-video');
  assert.deepEqual(cleanupCalls, [['old-producer', { producerUserId: 'user-screen', source: 'screen-video' }]]);
  assert.equal(screenShareVideos.get('producer-screen').userId, 'user-screen');
  assert.equal(consumers.has('producer-screen'), true);
  assert.equal(producerUserMap.get('producer-screen'), 'user-screen');
  assert.equal(diagnostics.consumers['producer-screen'].source, 'screen-video');
  assert.equal(laneEvents.some((entry) => entry[1] === 'consume_requested'), true);
});
