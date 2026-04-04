import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAudioConsumerDiagnostics,
  buildScreenConsumerDiagnostics,
} from '../../../client/src/features/voice/voiceConsumerDiagnostics.mjs';

test('voice consumer diagnostics builds stable screen payloads', () => {
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

test('voice consumer diagnostics builds stable audio payloads', () => {
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
