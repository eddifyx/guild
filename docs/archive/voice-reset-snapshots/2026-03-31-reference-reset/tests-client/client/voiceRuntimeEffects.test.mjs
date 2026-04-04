import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createVoiceUnmountCleanup,
  registerVoiceAppleSupportEffect,
  registerVoiceConsumerQualityEffect,
  registerVoiceDiagnosticsStatsEffect,
  registerVoiceKeyUpdatedEffect,
  registerVoiceScreenShareStatsEffect,
  registerVoiceSocketEffect,
  syncVoiceScreenShareDiagnosticsEffect,
} from '../../../client/src/features/voice/voiceRuntimeEffects.mjs';

test('voice runtime effects register socket handlers and unwrap producer user entries', () => {
  const subscriptions = new Map();
  const removals = [];
  const socket = {
    on(event, handler) {
      subscriptions.set(event, handler);
    },
    off(event, handler) {
      removals.push([event, handler]);
    },
  };
  const calls = [];
  const unsubscribe = registerVoiceSocketEffect({
    socket,
    currentUserId: 'user-1',
    producerUserMapRef: {
      current: new Map([
        ['producer-1', 'user-2'],
      ]),
    },
    getCurrentChannelIdFn: () => 'channel-1',
    getUntrustedVoiceParticipantsFn: () => [],
    buildVoiceTrustErrorFn: () => null,
    rememberUsersFn: () => {},
    setJoinErrorFn: () => {},
    setVoiceE2EFn: () => {},
    setE2EWarningFn: () => {},
    leaveChannelFn: () => {},
    syncVoiceParticipantsFn: async () => {},
    syncVoiceE2EStateFn: async () => {},
    handleUnexpectedVoiceSessionEndFn: async () => {},
    cleanupRemoteProducerFn: () => {},
    consumeProducerFn: async () => {},
    isExpectedVoiceTeardownErrorFn: () => false,
    setPeersFn: () => {},
    resetVoiceSessionFn: async () => {},
    getParticipantIdsFn: () => ['user-1'],
    updateVoiceDiagnosticsFn: () => {},
  });

  assert.equal(subscriptions.has('voice:producer-closed'), true);
  subscriptions.get('voice:producer-closed')({ producerId: 'producer-1' });
  unsubscribe();

  assert.equal(removals.length > 0, true);
});

test('voice runtime effects register and unregister the voice-key-updated listener', () => {
  const added = [];
  const removed = [];
  const fakeWindow = {
    addEventListener(event, handler) {
      added.push([event, handler]);
    },
    removeEventListener(event, handler) {
      removed.push([event, handler]);
    },
  };

  const cleanup = registerVoiceKeyUpdatedEffect({
    windowObject: fakeWindow,
    getCurrentChannelIdFn: () => 'channel-2',
    getParticipantIdsFn: () => ['user-1', 'user-2'],
    setJoinErrorFn: () => {},
    setVoiceE2EFn: () => {},
    setE2EWarningFn: () => {},
    updateVoiceDiagnosticsFn: () => {},
    resumeVoiceMediaAfterKeyUpdateFn: async () => ({ resumed: true }),
  });

  assert.equal(added.length, 1);
  assert.equal(added[0][0], 'voice-key-updated');
  cleanup();
  assert.deepEqual(removed, added);
});

test('voice runtime effects build unmount cleanup that cancels reconfigure work and leaves active voice', () => {
  const cleared = [];
  let leaveCount = 0;
  const pendingLiveReconfigureRef = { current: 'timeout-1' };
  const channelIdRef = { current: 'channel-3' };

  const cleanup = createVoiceUnmountCleanup({
    refs: {
      pendingLiveReconfigureRef,
      channelIdRef,
    },
    leaveChannelFn: () => {
      leaveCount += 1;
    },
    clearTimeoutFn: (timeoutId) => {
      cleared.push(timeoutId);
    },
  });

  cleanup();

  assert.deepEqual(cleared, ['timeout-1']);
  assert.equal(pendingLiveReconfigureRef.current, null);
  assert.equal(leaveCount, 1);
});

test('voice runtime effects gate diagnostics and consumer-quality registrations by channel and availability', () => {
  const diagnosticsStop = registerVoiceDiagnosticsStatsEffect({
    channelId: 'channel-4',
    refs: {
      producerRef: { current: null },
      consumersRef: { current: new Map() },
    },
    summarizeProducerStatsFn: () => ({}),
    summarizeConsumerStatsFn: () => ({}),
    updateVoiceDiagnosticsFn: () => {},
    isVoiceDiagnosticsEnabledFn: () => true,
    setIntervalFn: () => 'interval-1',
    clearIntervalFn: () => {},
  });

  const qualityStop = registerVoiceConsumerQualityEffect({
    channelId: 'channel-4',
    socket: { emit() {} },
    refs: {
      consumersRef: { current: new Map() },
      producerMetaRef: { current: new Map() },
    },
    summarizeConsumerStatsFn: () => ({}),
    setIntervalFn: () => 'interval-2',
    clearIntervalFn: () => {},
  });

  assert.equal(typeof diagnosticsStop, 'function');
  assert.equal(typeof qualityStop, 'function');
  assert.equal(registerVoiceDiagnosticsStatsEffect({ channelId: null }), undefined);
  assert.equal(registerVoiceConsumerQualityEffect({ channelId: 'channel-4', socket: null }), undefined);
});

test('voice runtime effects sync screen share diagnostics only when diagnostics are enabled', () => {
  let diagnostics = { senderStats: { bitrate: 1 } };

  const changed = syncVoiceScreenShareDiagnosticsEffect({
    screenShareDiagnostics: { active: true },
    isVoiceDiagnosticsEnabledFn: () => true,
    updateVoiceDiagnosticsFn: (updater) => {
      diagnostics = updater(diagnostics);
    },
  });

  const skipped = syncVoiceScreenShareDiagnosticsEffect({
    screenShareDiagnostics: { active: false },
    isVoiceDiagnosticsEnabledFn: () => false,
    updateVoiceDiagnosticsFn: () => {
      throw new Error('should not update when disabled');
    },
  });

  assert.equal(changed, true);
  assert.equal(skipped, false);
  assert.deepEqual(diagnostics, {
    senderStats: { bitrate: 1 },
    screenShare: { active: true },
  });
});

test('voice runtime effects gate screen share stats registration on active sharing', () => {
  const stop = registerVoiceScreenShareStatsEffect({
    screenSharing: true,
    refs: {
      screenShareProducerRef: { current: null },
      screenShareStreamRef: { current: null },
      screenShareStatsRef: { current: null },
      screenShareProfileIndexRef: { current: 0 },
      screenShareSimulcastEnabledRef: { current: false },
      screenShareAdaptationRef: { current: null },
    },
    setScreenShareDiagnosticsFn: () => {},
    maybeAdaptScreenShareProfileFn: async () => {},
    summarizeProducerStatsFn: () => ({}),
    summarizeTrackSnapshotFn: () => ({}),
    summarizeScreenShareProfileFn: () => ({}),
    summarizeScreenShareHardwareFn: () => ({}),
    screenShareProfiles: [],
    setIntervalFn: () => 'interval-3',
    clearIntervalFn: () => {},
  });

  assert.equal(typeof stop, 'function');
  assert.equal(registerVoiceScreenShareStatsEffect({ screenSharing: false }), undefined);
});

test('voice runtime effects probe Apple voice support only when the feature is relevant', async () => {
  const appleVoiceAvailableRef = { current: true };
  let resolver = null;
  const cleanup = registerVoiceAppleSupportEffect({
    prefersAppleSystemVoiceIsolationFn: () => true,
    electronAPI: {
      isAppleVoiceCaptureSupported() {
        return new Promise((resolve) => {
          resolver = resolve;
        });
      },
    },
    appleVoiceAvailableRef,
  });

  resolver(false);
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(typeof cleanup, 'function');
  assert.equal(appleVoiceAvailableRef.current, false);
  cleanup();
  assert.equal(registerVoiceAppleSupportEffect({
    prefersAppleSystemVoiceIsolationFn: () => false,
  }), undefined);
});
