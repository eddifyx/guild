import test from 'node:test';
import assert from 'node:assert/strict';

import { buildVoiceDiagnosticsDebugPayload } from '../../../client/src/features/voice/voiceDiagnosticsDebugModel.mjs';

test('voice diagnostics debug model returns null without an active channel update', () => {
  assert.equal(buildVoiceDiagnosticsDebugPayload({
    channelId: null,
    voiceDiagnostics: { updatedAt: '2026-04-01T00:00:00.000Z' },
  }), null);

  assert.equal(buildVoiceDiagnosticsDebugPayload({
    channelId: 'channel-1',
    voiceDiagnostics: null,
  }), null);
});

test('voice diagnostics debug model summarizes sender and consumer packet state', () => {
  const payload = buildVoiceDiagnosticsDebugPayload({
    channelId: 'channel-1',
    joinError: null,
    liveVoiceFallbackReason: null,
    voiceDiagnostics: {
      updatedAt: '2026-04-01T03:00:00.000Z',
      liveCapture: {
        outputTrackMode: 'direct-source-hotfix',
        filter: {
          backend: 'raw',
          fallbackReason: null,
        },
      },
      senderStats: {
        outboundAudio: {
          packetsSent: 42,
          bytesSent: 4096,
          codecMimeType: 'audio/opus',
        },
        remoteInboundAudio: {
          packetsLost: 0,
          jitterMs: 1.2,
        },
      },
      consumers: {
        'producer-1': {
          producerUserId: 'user-2',
          producerSource: 'microphone',
          playback: {
            state: 'live-playing',
            error: null,
          },
          stats: {
            inboundAudio: {
              packetsReceived: 39,
              bytesReceived: 3900,
              totalAudioEnergy: 0.84,
              codecMimeType: 'audio/opus',
            },
          },
        },
      },
    },
  });

  assert.equal(payload.channelId, 'channel-1');
  assert.equal(payload.outputTrackMode, 'direct-source-hotfix');
  assert.equal(payload.captureBackend, 'raw');
  assert.deepEqual(payload.sender.outboundAudio, {
    packets: 42,
    bytes: 4096,
    totalAudioEnergy: null,
    jitterMs: null,
    codecMimeType: 'audio/opus',
  });
  assert.deepEqual(payload.sender.remoteInboundAudio, {
    packets: null,
    bytes: null,
    totalAudioEnergy: null,
    jitterMs: 1.2,
    codecMimeType: null,
  });
  assert.deepEqual(payload.consumers['producer-1'], {
    userId: 'user-2',
    source: 'microphone',
    playbackState: 'live-playing',
    playbackError: null,
    inboundAudio: {
      packets: 39,
      bytes: 3900,
      totalAudioEnergy: 0.84,
      jitterMs: null,
      codecMimeType: 'audio/opus',
    },
  });
});
