import test from 'node:test';
import assert from 'node:assert/strict';

import { runVoiceHealthProbeCheck } from '../../../client/src/features/voice/voiceHealthProbeRuntime.mjs';

test('voice health probe runtime resets retry count when outbound packets are flowing', async () => {
  let diagnostics = {
    senderStats: null,
  };
  const retryCountRef = { current: 1 };
  const debugLogs = [];

  const result = await runVoiceHealthProbeCheck({
    chId: 'channel-1',
    currentChannelId: 'channel-1',
    muted: false,
    producer: {
      async getStats() {
        return { id: 'stats-1' };
      },
    },
    retryCountRef,
    summarizeProducerStatsFn: () => ({
      outboundAudio: {
        packetsSent: 2,
        bytesSent: 128,
      },
    }),
    updateVoiceDiagnosticsFn: (updater) => {
      diagnostics = updater(diagnostics);
    },
    nowIsoFn: () => '2026-03-25T12:00:00.000Z',
    debugLogFn: (...args) => debugLogs.push(args),
  });

  assert.equal(retryCountRef.current, 0);
  assert.equal(result.shouldReschedule, false);
  assert.deepEqual(diagnostics.senderStats, {
    outboundAudio: {
      packetsSent: 2,
      bytesSent: 128,
    },
    sampledAt: '2026-03-25T12:00:00.000Z',
  });
  assert.equal(debugLogs.length, 1);
  assert.equal(debugLogs[0][0], 'voice-health');
  assert.match(debugLogs[0][1], /"packetsSent":2/);
});

test('voice health probe runtime merges sender-side track stats when available', async () => {
  let diagnostics = { senderStats: null };

  await runVoiceHealthProbeCheck({
    chId: 'channel-merge',
    currentChannelId: 'channel-merge',
    muted: false,
    producer: {
      async getStats() {
        return { kind: 'producer-stats' };
      },
      rtpSender: {
        async getStats() {
          return { kind: 'sender-stats' };
        },
      },
    },
    summarizeProducerStatsFn: (stats) => (
      stats?.kind === 'sender-stats'
        ? { sourceAudio: { audioLevel: 0.42, totalAudioEnergy: 3.1 } }
        : { outboundAudio: { packetsSent: 4, bytesSent: 256 } }
    ),
    updateVoiceDiagnosticsFn: (updater) => {
      diagnostics = updater(diagnostics);
    },
    nowIsoFn: () => '2026-03-25T12:10:00.000Z',
  });

  assert.deepEqual(diagnostics.senderStats, {
    outboundAudio: {
      packetsSent: 4,
      bytesSent: 256,
    },
    sourceAudio: {
      audioLevel: 0.42,
      totalAudioEnergy: 3.1,
    },
    sampledAt: '2026-03-25T12:10:00.000Z',
  });
});

test('voice health probe runtime retries once when packets are still zero', async () => {
  const retryCountRef = { current: 0 };
  const warnings = [];
  let reconfigured = 0;

  const result = await runVoiceHealthProbeCheck({
    chId: 'channel-2',
    reason: 'join',
    currentChannelId: 'channel-2',
    muted: false,
    producer: {
      async getStats() {
        return { id: 'stats-2' };
      },
    },
    retryCountRef,
    summarizeProducerStatsFn: () => ({
      outboundAudio: {
        packetsSent: 0,
        bytesSent: 0,
      },
    }),
    updateVoiceDiagnosticsFn: () => {},
    reconfigureLiveCaptureFn: async () => {
      reconfigured += 1;
    },
    warnFn: (...args) => warnings.push(args),
  });

  assert.equal(retryCountRef.current, 1);
  assert.equal(reconfigured, 1);
  assert.equal(result.shouldReschedule, true);
  assert.equal(result.reconfigured, true);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0][0], /no packets/i);
});

test('voice health probe runtime does not retry more than once', async () => {
  const retryCountRef = { current: 1 };
  const warnings = [];

  const result = await runVoiceHealthProbeCheck({
    chId: 'channel-3',
    reason: 'post-reconfigure',
    currentChannelId: 'channel-3',
    muted: false,
    producer: {
      async getStats() {
        return { id: 'stats-3' };
      },
    },
    retryCountRef,
    summarizeProducerStatsFn: () => ({
      outboundAudio: {
        packetsSent: 0,
        bytesSent: 0,
      },
    }),
    updateVoiceDiagnosticsFn: () => {},
    reconfigureLiveCaptureFn: async () => {
      throw new Error('should not reconfigure again');
    },
    warnFn: (...args) => warnings.push(args),
  });

  assert.equal(retryCountRef.current, 1);
  assert.equal(result.shouldReschedule, false);
  assert.equal(result.reconfigured, false);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0][0], /still shows no packets/i);
});

test('voice health probe runtime is a no-op when the session is no longer active', async () => {
  const retryCountRef = { current: 0 };
  let diagnosticsUpdated = false;

  const result = await runVoiceHealthProbeCheck({
    chId: 'channel-4',
    currentChannelId: 'other-channel',
    muted: false,
    producer: {
      async getStats() {
        throw new Error('should not run');
      },
    },
    retryCountRef,
    updateVoiceDiagnosticsFn: () => {
      diagnosticsUpdated = true;
    },
  });

  assert.equal(result.shouldReschedule, false);
  assert.equal(result.reconfigured, false);
  assert.equal(diagnosticsUpdated, false);
  assert.equal(retryCountRef.current, 0);
});
