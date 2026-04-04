import test from 'node:test';
import assert from 'node:assert/strict';

import {
  startVoiceConsumerQualityRuntime,
  startVoiceDiagnosticsStatsRuntime,
} from '../../../client/src/features/voice/voiceDiagnosticsRuntime.mjs';

test('voice diagnostics runtime samples sender and consumer stats', async () => {
  let diagnostics = {
    consumers: {
      'producer-1': {
        existing: true,
      },
    },
  };
  const scheduled = [];
  const cleared = [];

  const stop = startVoiceDiagnosticsStatsRuntime({
    refs: {
      producerRef: {
        current: {
          async getStats() {
            return { id: 'sender-stats' };
          },
        },
      },
      consumersRef: {
        current: new Map([
          ['producer-1', {
            async getStats() {
              return { id: 'consumer-stats' };
            },
          }],
        ]),
      },
    },
    summarizeProducerStatsFn: () => ({ outboundAudio: { packetsSent: 4 } }),
    summarizeConsumerStatsFn: () => ({ inboundAudio: { packetsReceived: 8 } }),
    updateVoiceDiagnosticsFn: (updater) => {
      diagnostics = updater(diagnostics);
    },
    nowIsoFn: () => '2026-03-25T20:00:00.000Z',
    setIntervalFn: (callback, delayMs) => {
      scheduled.push({ callback, delayMs });
      return 'interval-1';
    },
    clearIntervalFn: (intervalId) => {
      cleared.push(intervalId);
    },
  });

  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0].delayMs, 2000);
  assert.deepEqual(diagnostics.senderStats, {
    outboundAudio: { packetsSent: 4 },
    sampledAt: '2026-03-25T20:00:00.000Z',
  });
  assert.deepEqual(diagnostics.consumers['producer-1'], {
    existing: true,
    stats: { inboundAudio: { packetsReceived: 8 } },
    sampledAt: '2026-03-25T20:00:00.000Z',
  });

  stop();
  assert.deepEqual(cleared, ['interval-1']);
});

test('voice consumer quality runtime emits only screen-video consumer stats', async () => {
  const emitted = [];
  const stop = startVoiceConsumerQualityRuntime({
    channelId: 'channel-1',
    socket: {
      emit(event, payload) {
        emitted.push([event, payload]);
      },
    },
    refs: {
      consumersRef: {
        current: new Map([
          ['producer-screen', {
            async getStats() {
              return { id: 'screen-consumer-stats' };
            },
          }],
          ['producer-audio', {
            async getStats() {
              return { id: 'audio-consumer-stats' };
            },
          }],
        ]),
      },
      producerMetaRef: {
        current: new Map([
          ['producer-screen', { source: 'screen-video' }],
          ['producer-audio', { source: 'microphone' }],
        ]),
      },
    },
    summarizeConsumerStatsFn: () => ({
      inboundVideo: {
        framesPerSecond: 30,
        jitterBufferAverageMs: 12,
        freezeCount: 1,
        pauseCount: 0,
      },
      candidatePair: {
        availableIncomingBitrate: 900000,
      },
    }),
    setIntervalFn: () => 'interval-2',
    clearIntervalFn: () => {},
  });

  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(emitted, [[
    'voice:consumer-quality',
    {
      channelId: 'channel-1',
      producerId: 'producer-screen',
      availableIncomingBitrate: 900000,
      framesPerSecond: 30,
      jitterBufferDelayMs: 12,
      freezeCount: 1,
      pauseCount: 0,
    },
  ]]);

  stop();
});
