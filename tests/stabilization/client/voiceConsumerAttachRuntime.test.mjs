import test from 'node:test';
import assert from 'node:assert/strict';

import {
  attachAudioVoiceConsumer,
  attachScreenVoiceConsumer,
  attachVoiceConsumerDecryption,
  resumeVoiceConsumer,
} from '../../../client/src/features/voice/voiceConsumerAttachRuntime.mjs';

test('voice consumer attach runtime attaches receiver decryption when required', () => {
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

test('voice consumer attach runtime rejects receivers that cannot attach secure transforms', () => {
  assert.throws(() => {
    attachVoiceConsumerDecryption({
      consumer: {
        rtpReceiver: { id: 'receiver-2' },
      },
      data: {
        kind: 'audio',
      },
      codecMimeType: 'audio/opus',
      shouldAttachReceiverDecryption: true,
      attachReceiverDecryptionFn: () => false,
    });
  }, /missing secure transform support/i);
});

test('voice consumer attach runtime resumes the local consumer and optionally resumes the server consumer', async () => {
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

test('voice consumer attach runtime attaches a screen consumer and updates diagnostics', async () => {
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

test('voice consumer attach runtime attaches an audio consumer and updates diagnostics', async () => {
  let diagnostics = { consumers: {} };
  const laneEvents = [];
  const audioElements = new Map();
  const userAudioEntries = [];
  const playbackCalls = [];
  const debugLogs = [];
  const scheduledTimeouts = [];
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
      paused: false,
      track: { id: 'track-audio' },
      async getStats() {
        return { id: 'consumer-stats-audio' };
      },
    },
    deafened: true,
    consumeStartedAt: '2026-03-25T12:00:00.000Z',
    consumeRequestMs: 2,
    consumeTransportMs: 3,
    decryptAttachMs: 4,
    voiceAudioBypassMode: 'bypassed',
    bypassVoiceAudioDecryption: true,
    codecMimeType: 'audio/opus',
    audioElementsMap: audioElements,
    mountRemoteAudioElementFn: (audio) => { audio.mounted = true; },
    applyVoiceOutputDeviceFn: async (audio, outputId) => {
      audio.outputId = outputId;
    },
    readStoredVoiceOutputDeviceIdFn: () => 'speaker-1',
    setUserAudioEntryFn: (...args) => userAudioEntries.push(args),
    recordLaneDiagnosticFn: (...args) => laneEvents.push(args),
    readStoredUserVolumeFn: () => 0.4,
    resumeVoiceConsumerFn: async () => { resumed += 1; },
    attachVoiceConsumerPlaybackRuntimeFn: (options) => playbackCalls.push(options),
    updateVoiceDiagnosticsFn: (updater) => {
      diagnostics = updater(diagnostics);
    },
    summarizeTrackSnapshotFn: (track) => track?.id || null,
    summarizeConsumerStatsFn: () => ({
      inboundAudio: {
        packetsReceived: 12,
        bytesReceived: 900,
      },
    }),
    summarizeReceiverVideoCodecSupportFn: () => ({ opus: true }),
    mediaStreamCtor: FakeStream,
    audioCtor: FakeAudio,
    nowFn: (() => {
      let tick = 0;
      return () => (tick += 5);
    })(),
    roundMsFn: (value) => value,
    debugLogFn: (...args) => debugLogs.push(args),
    setTimeoutFn: (callback, delayMs) => {
      scheduledTimeouts.push(delayMs);
      callback();
      return delayMs;
    },
  });

  assert.equal(result.audio.outputId, 'speaker-1');
  assert.equal(result.audio.muted, true);
  assert.equal(result.audio.volume, 0.4);
  assert.equal(audioElements.get('producer-audio'), result.audio);
  assert.deepEqual(userAudioEntries, [['user-audio', 'producer-audio', result.audio]]);
  assert.equal(playbackCalls.length, 1);
  assert.equal(resumed, 1);
  assert.equal(laneEvents[0][1], 'consumer_ready');
  assert.equal(diagnostics.consumers['producer-audio'].e2eeMode, 'bypassed');
  assert.deepEqual(scheduledTimeouts, [1000, 4000]);
  assert.equal(debugLogs.length, 2);
  assert.equal(debugLogs[0][0], 'voice-consumer-stats');
  assert.match(debugLogs[0][1], /"packetsReceived":12/);
});

test('voice consumer attach runtime falls back to receiver stats when consumer stats are empty', async () => {
  const debugLogs = [];

  class FakeStream {
    constructor(tracks) {
      this.tracks = tracks;
    }
  }

  class FakeAudio {
    constructor() {
      this.volume = 1;
      this.muted = false;
      this.defaultMuted = false;
    }
  }

  await attachAudioVoiceConsumer({
    chId: 'channel-receiver',
    producerId: 'producer-receiver',
    producerUserId: 'user-receiver',
    producerSource: 'microphone',
    data: { kind: 'audio', paused: false },
    consumer: {
      track: { id: 'track-receiver' },
      async getStats() {
        return { kind: 'consumer-empty' };
      },
      rtpReceiver: {
        async getStats() {
          return { kind: 'receiver-stats' };
        },
      },
    },
    audioElementsMap: new Map(),
    mountRemoteAudioElementFn: () => {},
    applyVoiceOutputDeviceFn: async () => {},
    readStoredVoiceOutputDeviceIdFn: () => 'default',
    setUserAudioEntryFn: () => {},
    recordLaneDiagnosticFn: () => {},
    readStoredUserVolumeFn: () => 1,
    resumeVoiceConsumerFn: async () => {},
    attachVoiceConsumerPlaybackRuntimeFn: () => {},
    updateVoiceDiagnosticsFn: () => {},
    summarizeTrackSnapshotFn: () => null,
    summarizeConsumerStatsFn: (stats) => (
      stats?.kind === 'receiver-stats'
        ? { inboundAudio: { packetsReceived: 21, bytesReceived: 2048 }, receiverAudio: { totalAudioEnergy: 1.7 } }
        : {}
    ),
    summarizeReceiverVideoCodecSupportFn: () => null,
    mediaStreamCtor: FakeStream,
    audioCtor: FakeAudio,
    debugLogFn: (...args) => debugLogs.push(args),
    setTimeoutFn: (callback) => {
      callback();
      return 0;
    },
  });

  await Promise.resolve();
  assert.equal(debugLogs.length, 2);
  assert.match(debugLogs[0][1], /"packetsReceived":21/);
  assert.match(debugLogs[0][1], /"totalAudioEnergy":1.7/);
});
