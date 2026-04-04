import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createVoiceHookScreenShareRuntimeBridge,
  createVoiceHookScreenShareRuntimeDeps,
  syncVoiceHookScreenShareRuntimeDeps,
} from '../../../client/src/features/voice/voiceHookScreenShareRuntimeBridge.mjs';

test('voice hook screen share runtime bridge exposes canonical default dependency slots', async () => {
  const deps = createVoiceHookScreenShareRuntimeDeps();

  assert.equal(await deps.ensureSecureMediaReadyFn(), true);
  assert.equal(await deps.ensureVoiceKeyForParticipantsFn('peer-1'), undefined);
  assert.equal(await deps.getOrCreateScreenSendTransportFn('room-1'), null);
  assert.equal(deps.cleanupScreenShareSessionFn(), undefined);
});

test('voice hook screen share runtime bridge syncs the latest dependency bag onto the ref', async () => {
  const depsRef = { current: createVoiceHookScreenShareRuntimeDeps() };
  const calls = [];

  const synced = syncVoiceHookScreenShareRuntimeDeps(depsRef, {
    ensureSecureMediaReadyFn: async () => 'ready',
    ensureVoiceKeyForParticipantsFn: async (...args) => {
      calls.push(['key', args]);
      return 'voice-key';
    },
    getOrCreateScreenSendTransportFn: async () => 'transport',
    cleanupScreenShareSessionFn: () => {
      calls.push(['cleanup']);
      return 'clean';
    },
  });

  assert.equal(synced, depsRef.current);
  assert.equal(await depsRef.current.ensureSecureMediaReadyFn(), 'ready');
  assert.equal(await depsRef.current.ensureVoiceKeyForParticipantsFn('peer-2'), 'voice-key');
  assert.equal(await depsRef.current.getOrCreateScreenSendTransportFn(), 'transport');
  assert.equal(depsRef.current.cleanupScreenShareSessionFn(), 'clean');
  assert.deepEqual(calls, [
    ['key', ['peer-2']],
    ['cleanup'],
  ]);
});

test('voice hook screen share runtime bridge defers to the latest injected dependencies', async () => {
  const calls = [];
  const depsRef = {
    current: {
      ensureSecureMediaReadyFn: async () => 'ready-initial',
      ensureVoiceKeyForParticipantsFn: async (...args) => {
        calls.push(['key-initial', args]);
        return 'key-initial';
      },
      getOrCreateScreenSendTransportFn: async () => 'transport-initial',
      cleanupScreenShareSessionFn: () => {
        calls.push(['cleanup-initial']);
        return 'cleanup-initial';
      },
    },
  };

  const runtime = createVoiceHookScreenShareRuntimeBridge({ depsRef });

  assert.equal(await runtime.ensureSecureMediaReadyFn(), 'ready-initial');
  assert.equal(await runtime.ensureVoiceKeyForParticipantsFn('peer-1'), 'key-initial');
  assert.equal(await runtime.getOrCreateScreenSendTransportFn(), 'transport-initial');
  assert.equal(runtime.cleanupScreenShareSessionFn(), 'cleanup-initial');

  depsRef.current.ensureSecureMediaReadyFn = async () => 'ready-updated';
  depsRef.current.ensureVoiceKeyForParticipantsFn = async (...args) => {
    calls.push(['key-updated', args]);
    return 'key-updated';
  };
  depsRef.current.getOrCreateScreenSendTransportFn = async () => 'transport-updated';
  depsRef.current.cleanupScreenShareSessionFn = () => {
    calls.push(['cleanup-updated']);
    return 'cleanup-updated';
  };

  assert.equal(await runtime.ensureSecureMediaReadyFn(), 'ready-updated');
  assert.equal(await runtime.ensureVoiceKeyForParticipantsFn('peer-2'), 'key-updated');
  assert.equal(await runtime.getOrCreateScreenSendTransportFn(), 'transport-updated');
  assert.equal(runtime.cleanupScreenShareSessionFn(), 'cleanup-updated');
  assert.deepEqual(calls, [
    ['key-initial', ['peer-1']],
    ['cleanup-initial'],
    ['key-updated', ['peer-2']],
    ['cleanup-updated'],
  ]);
});
