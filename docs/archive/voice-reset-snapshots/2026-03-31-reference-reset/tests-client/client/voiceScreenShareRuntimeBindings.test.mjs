import test from 'node:test';
import assert from 'node:assert/strict';

import { createVoiceScreenShareRuntimeBindings } from '../../../client/src/features/voice/voiceScreenShareRuntimeBindings.mjs';

test('voice screen share runtime bindings reset adaptation state and delegate publish/runtime flows', async () => {
  const calls = [];
  const bindings = createVoiceScreenShareRuntimeBindings({
    refs: {
      deviceRef: { current: { id: 'device-1' } },
      screenSendTransportRef: { current: { id: 'transport-1' } },
      screenShareStreamRef: { current: { id: 'stream-1' } },
      screenShareProducerRef: { current: { id: 'producer-1' } },
      screenShareStatsRef: { current: { bitrate: 10 } },
      screenShareProfileIndexRef: { current: 3 },
      screenShareSimulcastEnabledRef: { current: true },
      screenSharePromotionInFlightRef: { current: true },
      screenSharePromotionCooldownUntilRef: { current: 999 },
      screenShareAdaptationRef: { current: { degradeSamples: 4 } },
    },
    setters: {
      setScreenShareDiagnosticsFn: (value) => calls.push(['setDiagnostics', value]),
    },
    runtime: {
      getRuntimeScreenShareCodecModeFn: () => 'h264',
      performanceNowFn: () => 123,
      nowIsoFn: () => '2026-03-25T00:00:00.000Z',
      warnFn: (...args) => calls.push(['warn', ...args]),
    },
    constants: {
      screenShareProfiles: [{ id: 'profile-0' }],
      promotionFailureCooldownMs: 2000,
      adaptationHoldMs: 500,
      initialProfileIndex: 1,
    },
    deps: {
      publishVoiceScreenShareVideoProducerFn: async (payload) => {
        calls.push(['publish', payload]);
        return 'published';
      },
      applyVoiceScreenShareProfileFn: async (payload) => {
        calls.push(['applyProfile', payload]);
        return 'applied';
      },
      promoteVoiceScreenShareToSimulcastFn: async (payload) => {
        calls.push(['promote', payload]);
        return 'promoted';
      },
      maybeAdaptVoiceScreenShareProfileFn: async (payload) => {
        calls.push(['adapt', payload]);
        return 'adapted';
      },
    },
  });

  bindings.resetScreenShareAdaptation();
  await bindings.publishScreenShareVideoProducer({
    track: { id: 'track-1' },
    transport: { id: 'send-1' },
    profile: { id: 'profile-1' },
    screenShareCodecMode: 'vp9',
    simulcast: true,
  });
  await bindings.applyScreenShareProfile(0, { reason: 'manual-test', force: true });
  await bindings.promoteScreenShareToSimulcast({ reason: 'auto-test' });
  await bindings.maybeAdaptScreenShareProfile({ bitrate: 12345 });

  assert.equal(calls[0][0], 'publish');
  assert.equal(calls[0][1].device.id, 'device-1');
  assert.equal(calls[1][0], 'applyProfile');
  assert.equal(calls[1][1].reason, 'manual-test');
  assert.equal(calls[2][0], 'promote');
  assert.equal(calls[2][1].reason, 'auto-test');
  assert.equal(calls[3][0], 'adapt');
});

test('voice screen share runtime bindings reset refs back to the canonical cold-start state', () => {
  const refs = {
    screenShareProfileIndexRef: { current: 4 },
    screenShareSimulcastEnabledRef: { current: true },
    screenSharePromotionInFlightRef: { current: true },
    screenSharePromotionCooldownUntilRef: { current: 99 },
    screenShareAdaptationRef: { current: { degradeSamples: 7 } },
  };

  const bindings = createVoiceScreenShareRuntimeBindings({
    refs,
    constants: {
      initialProfileIndex: 2,
    },
  });

  bindings.resetScreenShareAdaptation();

  assert.equal(refs.screenShareProfileIndexRef.current, 2);
  assert.equal(refs.screenShareSimulcastEnabledRef.current, false);
  assert.equal(refs.screenSharePromotionInFlightRef.current, false);
  assert.equal(refs.screenSharePromotionCooldownUntilRef.current, 0);
  assert.deepEqual(refs.screenShareAdaptationRef.current, {
    degradeSamples: 0,
    recoverySamples: 0,
    lastChangedAtMs: 0,
    lastReason: 'cold-start',
  });
});
