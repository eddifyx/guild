import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyVoiceScreenShareProfile,
  maybeAdaptVoiceScreenShareProfile,
  promoteVoiceScreenShareToSimulcast,
  publishVoiceScreenShareVideoProducer,
} from '../../../client/src/features/voice/voiceScreenShareRuntime.mjs';

test('publishVoiceScreenShareVideoProducer publishes video, applies sender preferences, and attaches encryption when needed', async () => {
  const calls = [];
  const track = { id: 'track-1' };
  const producer = {
    rtpSender: { id: 'sender-1' },
    rtpParameters: { codecs: [{ mimeType: 'video/VP9' }] },
  };

  const result = await publishVoiceScreenShareVideoProducer({
    track,
    transport: {
      async produce(payload) {
        calls.push(['produce', payload.codec?.mimeType || null, payload.encodings.length]);
        return producer;
      },
    },
    profile: {
      fps: 30,
      maxBitrate: 900000,
      minBitrate: 300000,
      startBitrateKbps: 600,
      minBitrateKbps: 300,
    },
    screenShareCodecMode: 'vp9',
    device: { id: 'device-1' },
    getPreferredScreenShareCodecCandidatesFn: () => [{ mimeType: 'video/VP9' }],
    getSimulcastScreenShareEncodingsFn: () => [{ rid: 'f' }, { rid: 'h' }],
    getSingleScreenShareEncodingFn: () => ({ scaleResolutionDownBy: 1 }),
    applySenderPreferencesFn: async (_sender, options) => {
      calls.push(['sender-options', options.maxBitrate || null, options.maxFramerate]);
      return { encodings: [{ maxBitrate: options.maxBitrate || 0 }] };
    },
    attachSenderEncryptionFn: (_sender, payload) => calls.push(['encrypt', payload.codecMimeType]),
    getPrimaryCodecMimeTypeFromRtpParametersFn: () => 'video/VP9',
    getExperimentalScreenVideoBypassModeFn: () => null,
    warnFn: (...args) => calls.push(['warn', ...args]),
  });

  assert.equal(result.producer, producer);
  assert.equal(result.selectedScreenShareCodec.mimeType, 'video/VP9');
  assert.equal(result.bypassScreenVideoEncryption, false);
  assert.equal(result.streamMode, 'single');
  assert.deepEqual(calls.filter(([type]) => type === 'encrypt'), [['encrypt', 'video/VP9']]);
});

test('applyVoiceScreenShareProfile updates refs and diagnostics for the selected profile', async () => {
  const track = { id: 'track-1', contentHint: null };
  let diagnostics = {
    adaptation: { hardware: { gpu: false } },
    captureTrack: 'old-track',
    senderParameters: { old: true },
  };
  const refs = {
    screenShareStreamRef: {
      current: {
        getVideoTracks() {
          return [track];
        },
      },
    },
    screenShareProducerRef: {
      current: {
        rtpSender: { id: 'sender-1' },
      },
    },
    screenShareProfileIndexRef: { current: 1 },
    screenShareSimulcastEnabledRef: { current: false },
    screenShareAdaptationRef: { current: null },
  };

  const applied = await applyVoiceScreenShareProfile({
    profileIndex: 0,
    reason: 'network-drop',
    refs,
    screenShareProfiles: [
      { id: 'high', fps: 30, maxBitrate: 900000 },
      { id: 'medium', fps: 15, maxBitrate: 300000 },
    ],
    applyPreferredScreenShareConstraintsFn: async () => {},
    applySenderPreferencesFn: async () => ({ encodings: [{ maxBitrate: 900000 }] }),
    getSingleScreenShareEncodingFn: () => ({ scaleResolutionDownBy: 1 }),
    summarizeTrackSnapshotFn: (value) => value.id,
    summarizeScreenShareProfileFn: (profile) => profile.id,
    summarizeSenderParametersFn: () => ({ bitrate: 'updated' }),
    summarizeScreenShareHardwareFn: () => ({ gpu: true }),
    setScreenShareDiagnosticsFn: (updater) => {
      diagnostics = typeof updater === 'function' ? updater(diagnostics) : updater;
    },
    performanceNowFn: () => 50,
    nowIsoFn: () => '2026-03-25T12:00:00.000Z',
  });

  assert.equal(applied, true);
  assert.equal(track.contentHint, 'motion');
  assert.equal(refs.screenShareProfileIndexRef.current, 0);
  assert.deepEqual(refs.screenShareAdaptationRef.current, {
    degradeSamples: 0,
    recoverySamples: 0,
    lastChangedAtMs: 50,
    lastReason: 'network-drop',
  });
  assert.equal(diagnostics.activeProfile, 'high');
  assert.equal(diagnostics.captureTrack, 'track-1');
  assert.deepEqual(diagnostics.senderParameters, { bitrate: 'updated' });
});

test('promoteVoiceScreenShareToSimulcast swaps producers and records promotion diagnostics', async () => {
  const currentProducer = {
    closeCalled: false,
    close() {
      this.closeCalled = true;
    },
  };
  let diagnostics = {
    adaptation: { hardware: { gpu: true } },
    senderParameters: { before: true },
  };
  const refs = {
    screenSendTransportRef: { current: { closed: false } },
    screenShareStreamRef: {
      current: {
        getVideoTracks() {
          return [{ id: 'track-1', contentHint: null }];
        },
      },
    },
    screenShareProducerRef: { current: currentProducer },
    screenShareSimulcastEnabledRef: { current: false },
    screenSharePromotionInFlightRef: { current: false },
    screenSharePromotionCooldownUntilRef: { current: 0 },
    screenShareStatsRef: { current: { sent: true } },
    screenShareProfileIndexRef: { current: 2 },
    screenShareAdaptationRef: { current: null },
  };

  const promoted = await promoteVoiceScreenShareToSimulcast({
    refs,
    reason: 'healthy-bitrate',
    screenShareProfiles: [{ id: 'high', fps: 30 }],
    promotionFailureCooldownMs: 5000,
    applyPreferredScreenShareConstraintsFn: async () => {},
    publishScreenShareVideoProducerFn: async () => ({
      producer: { id: 'new-producer' },
      selectedScreenShareCodec: { mimeType: 'video/VP9' },
      screenVideoBypassMode: null,
      bypassScreenVideoEncryption: false,
      senderParameters: { encodings: [{ rid: 'f' }] },
    }),
    applyScreenShareProfileFn: async () => false,
    summarizeTrackSnapshotFn: (track) => track.id,
    summarizeScreenShareProfileFn: (profile) => profile.id,
    summarizeSelectedCodecFn: (codec) => codec.mimeType,
    summarizeSenderParametersFn: () => ({ bitrate: 'simulcast' }),
    summarizeScreenShareHardwareFn: () => ({ gpu: true }),
    setScreenShareDiagnosticsFn: (updater) => {
      diagnostics = typeof updater === 'function' ? updater(diagnostics) : updater;
    },
    performanceNowFn: () => 100,
    nowIsoFn: () => '2026-03-25T12:05:00.000Z',
    normalizeVoiceErrorMessageFn: (err) => err?.message || '',
  });

  assert.equal(promoted, true);
  assert.equal(currentProducer.closeCalled, true);
  assert.deepEqual(refs.screenShareProducerRef.current, { id: 'new-producer' });
  assert.equal(refs.screenShareSimulcastEnabledRef.current, true);
  assert.equal(refs.screenShareStatsRef.current, null);
  assert.equal(refs.screenShareProfileIndexRef.current, 0);
  assert.equal(diagnostics.producerMode, 'simulcast');
  assert.equal(diagnostics.selectedCodec, 'video/VP9');
});

test('maybeAdaptVoiceScreenShareProfile promotes or applies profiles from adaptation decisions', async () => {
  const refs = {
    screenShareProfileIndexRef: { current: 1 },
    screenShareAdaptationRef: { current: { lastReason: 'before' } },
    screenShareSimulcastEnabledRef: { current: false },
    screenSharePromotionInFlightRef: { current: false },
  };
  const calls = [];

  await maybeAdaptVoiceScreenShareProfile({
    senderStats: { packetsLost: 0 },
    refs,
    screenShareProfiles: [{ id: 'high' }, { id: 'mid' }],
    adaptationHoldMs: 1500,
    initialProfileIndex: 0,
    decideScreenShareAdaptationFn: () => ({
      nextAdaptation: { lastReason: 'promote' },
      action: { type: 'promote-simulcast', reason: 'stable' },
    }),
    applyScreenShareProfileFn: async (...args) => calls.push(['apply', ...args]),
    promoteScreenShareToSimulcastFn: async (...args) => calls.push(['promote', ...args]),
    performanceNowFn: () => 99,
  });

  assert.deepEqual(refs.screenShareAdaptationRef.current, { lastReason: 'promote' });
  assert.deepEqual(calls, [['promote', { reason: 'stable' }]]);
});
