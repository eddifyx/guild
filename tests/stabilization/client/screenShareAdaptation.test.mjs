import test from 'node:test';
import assert from 'node:assert/strict';

import {
  decideScreenShareAdaptation,
  getBitrateBps,
  SCREEN_SHARE_DOWNGRADE_SAMPLE_THRESHOLD,
  SCREEN_SHARE_UPGRADE_SAMPLE_THRESHOLD,
} from '../../../client/src/features/voice/screenShareAdaptation.mjs';

const profiles = [
  { id: 'ultra', maxBitrate: 6_000_000, fps: 30 },
  { id: 'balanced', maxBitrate: 3_000_000, fps: 30 },
  { id: 'fallback', maxBitrate: 1_500_000, fps: 24 },
];

test('screen share adaptation normalizes bitrate stats', () => {
  assert.equal(getBitrateBps(3200), 3_200_000);
  assert.equal(getBitrateBps(3200, 4_000_000), 4_000_000);
  assert.equal(getBitrateBps(null), null);
});

test('screen share adaptation requests a downgrade after sustained pressure', () => {
  const adaptation = {
    degradeSamples: SCREEN_SHARE_DOWNGRADE_SAMPLE_THRESHOLD - 1,
    recoverySamples: 2,
    lastChangedAtMs: 0,
    lastReason: 'initial',
  };

  const decision = decideScreenShareAdaptation({
    senderStats: {
      outboundVideo: {
        qualityLimitationReason: 'cpu',
        framesPerSecond: 18,
      },
    },
    currentProfileIndex: 1,
    profiles,
    adaptation,
    now: 5000,
    holdMs: 3000,
  });

  assert.deepEqual(decision.nextAdaptation, {
    ...adaptation,
    degradeSamples: SCREEN_SHARE_DOWNGRADE_SAMPLE_THRESHOLD,
    recoverySamples: 0,
  });
  assert.deepEqual(decision.action, {
    type: 'apply-profile',
    profileIndex: 2,
    reason: 'auto-cpu-pressure',
  });
});

test('screen share adaptation requests headroom recovery and simulcast promotion from the initial profile', () => {
  const adaptation = {
    degradeSamples: 1,
    recoverySamples: SCREEN_SHARE_UPGRADE_SAMPLE_THRESHOLD - 1,
    lastChangedAtMs: 0,
    lastReason: 'initial',
  };

  const decision = decideScreenShareAdaptation({
    senderStats: {
      outboundVideo: {
        qualityLimitationReason: 'none',
        framesEncoded: 30,
      },
      candidatePair: {
        availableOutgoingBitrateBps: 7_000_000,
      },
      remoteInboundVideo: {
        roundTripTimeMs: 40,
      },
    },
    currentProfileIndex: 1,
    profiles,
    adaptation,
    now: 6000,
    holdMs: 3000,
    initialProfileIndex: 1,
  });

  assert.equal(decision.nextAdaptation.degradeSamples, 0);
  assert.equal(decision.nextAdaptation.recoverySamples, SCREEN_SHARE_UPGRADE_SAMPLE_THRESHOLD);
  assert.deepEqual(decision.action, {
    type: 'promote-simulcast',
    reason: 'auto-promoted-simulcast',
  });
});

test('screen share adaptation resets counters when there is no pressure or recovery headroom', () => {
  const adaptation = {
    degradeSamples: 2,
    recoverySamples: 4,
    lastChangedAtMs: 1000,
    lastReason: 'initial',
  };

  const decision = decideScreenShareAdaptation({
    senderStats: {
      outboundVideo: {
        qualityLimitationReason: 'none',
        framesEncoded: 10,
        framesPerSecond: 30,
      },
      candidatePair: {
        availableOutgoingBitrateBps: 5_000_000,
      },
      remoteInboundVideo: {
        roundTripTimeMs: 150,
      },
    },
    currentProfileIndex: 1,
    profiles,
    adaptation,
    now: 1500,
    holdMs: 3000,
    initialProfileIndex: 0,
  });

  assert.deepEqual(decision.nextAdaptation, {
    ...adaptation,
    degradeSamples: 0,
    recoverySamples: 0,
  });
  assert.equal(decision.action, null);
});
