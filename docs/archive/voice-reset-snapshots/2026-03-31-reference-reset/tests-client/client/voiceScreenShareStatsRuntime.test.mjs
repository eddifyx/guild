import test from 'node:test';
import assert from 'node:assert/strict';

import { startVoiceScreenShareStatsRuntime } from '../../../client/src/features/voice/voiceScreenShareStatsRuntime.mjs';

test('voice screen share stats runtime samples sender state and updates diagnostics', async () => {
  let diagnostics = {};
  const track = { id: 'track-1' };
  const statsRef = {
    current: {
      timestamp: 100,
      bytesSent: 1000,
    },
  };
  const scheduled = [];
  const stop = startVoiceScreenShareStatsRuntime({
    refs: {
      screenShareProducerRef: {
        current: {
          async getStats() {
            return { id: 'screen-share-stats' };
          },
        },
      },
      screenShareStreamRef: {
        current: {
          getVideoTracks() {
            return [track];
          },
        },
      },
      screenShareStatsRef: statsRef,
      screenShareProfileIndexRef: { current: 0 },
      screenShareSimulcastEnabledRef: { current: true },
      screenShareAdaptationRef: {
        current: {
          lastReason: 'recovered',
          degradeSamples: 1,
          recoverySamples: 2,
        },
      },
    },
    setScreenShareDiagnosticsFn: (updater) => {
      diagnostics = updater(diagnostics);
    },
    maybeAdaptScreenShareProfileFn: async () => {},
    summarizeProducerStatsFn: () => ({
      outboundVideo: {
        bytesSent: 2600,
      },
    }),
    summarizeTrackSnapshotFn: () => ({ id: 'track-1' }),
    summarizeScreenShareProfileFn: () => ({ label: 'profile-1' }),
    summarizeScreenShareHardwareFn: () => ({ encoder: 'hardware' }),
    screenShareProfiles: [{ id: 'profile-1' }],
    roundRateFn: (value) => Math.round(value * 10) / 10,
    performanceNowFn: () => 300,
    nowIsoFn: () => '2026-03-25T20:30:00.000Z',
    setIntervalFn: (callback, delayMs) => {
      scheduled.push({ callback, delayMs });
      return 'interval-3';
    },
    clearIntervalFn: () => {},
  });

  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0].delayMs, 1500);
  assert.equal(diagnostics.active, true);
  assert.deepEqual(diagnostics.captureTrack, { id: 'track-1' });
  assert.deepEqual(diagnostics.activeProfile, { label: 'profile-1' });
  assert.equal(diagnostics.producerMode, 'simulcast');
  assert.equal(diagnostics.sender.outboundVideo.bytesSent, 2600);
  assert.equal(diagnostics.sender.outgoingBitrateKbps, 64);
  assert.equal(diagnostics.sampledAt, '2026-03-25T20:30:00.000Z');
  assert.deepEqual(statsRef.current, {
    timestamp: 300,
    bytesSent: 2600,
  });

  stop();
});
