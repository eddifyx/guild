import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildVoiceSecureDiagnosticsState,
  syncVoiceE2EState,
} from '../../../client/src/features/voice/voiceE2EFlow.mjs';

function createStateContainer(initialValue) {
  return {
    value: initialValue,
    set(nextValue) {
      this.value = typeof nextValue === 'function' ? nextValue(this.value) : nextValue;
    },
  };
}

test('voice E2E flow reports bypassed diagnostics when voice safe mode is active', async () => {
  const voiceE2E = createStateContainer(false);
  const warning = createStateContainer('stale');
  const diagnostics = [];

  const result = await syncVoiceE2EState(['user-1', 'user-2'], {
    activeChannelId: 'channel-1',
    currentUserId: 'user-1',
    currentChannelId: 'channel-1',
    voiceSafeMode: true,
    getVoiceKeyFn: () => ({ key: new Uint8Array([1]), epoch: 7 }),
    setVoiceE2EFn: (nextValue) => voiceE2E.set(nextValue),
    setE2EWarningFn: (nextValue) => warning.set(nextValue),
    updateVoiceDiagnosticsFn: (updater) => diagnostics.push(typeof updater === 'function' ? updater({ session: {} }) : updater),
  });

  assert.equal(result.epoch, 7);
  assert.equal(voiceE2E.value, true);
  assert.equal(warning.value, null);
  assert.equal(diagnostics[0].session.secureVoice.state, 'bypassed');
});

test('voice E2E flow transitions to ready after secure key sync succeeds', async () => {
  const voiceE2E = createStateContainer(false);
  const warning = createStateContainer('stale');
  const joinError = createStateContainer('Voice chat is unavailable because the secure media key did not arrive in time.');
  const diagnostics = [];

  const result = await syncVoiceE2EState(['user-1', 'user-2'], {
    activeChannelId: 'channel-2',
    currentUserId: 'user-1',
    currentChannelId: 'channel-2',
    ensureVoiceKeyForParticipantsFn: async () => ({ key: new Uint8Array([2]), epoch: 8 }),
    getVoiceKeyFn: () => null,
    setVoiceE2EFn: (nextValue) => voiceE2E.set(nextValue),
    setE2EWarningFn: (nextValue) => warning.set(nextValue),
    setJoinErrorFn: (nextValue) => joinError.set(nextValue),
    updateVoiceDiagnosticsFn: (updater) => diagnostics.push(typeof updater === 'function' ? updater({ session: {} }) : updater),
  });

  assert.equal(result.epoch, 8);
  assert.equal(voiceE2E.value, true);
  assert.equal(warning.value, null);
  assert.equal(joinError.value, null);
  assert.equal(diagnostics.at(-1).session.secureVoice.state, 'ready');
});

test('voice E2E flow records waiting state and warning when secure key sync fails', async () => {
  const voiceE2E = createStateContainer(true);
  const warning = createStateContainer(null);
  const joinError = createStateContainer(null);
  const diagnostics = [];
  const timeoutCallbacks = [];

  const result = await syncVoiceE2EState(['user-1', 'user-2'], {
    activeChannelId: 'channel-3',
    currentUserId: 'user-1',
    currentChannelId: 'channel-3',
    ensureVoiceKeyForParticipantsFn: async () => {
      throw new Error('Voice chat is unavailable because the secure media key did not arrive in time.');
    },
    getVoiceKeyFn: () => null,
    setVoiceE2EFn: (nextValue) => voiceE2E.set(nextValue),
    setE2EWarningFn: (nextValue) => warning.set(nextValue),
    setJoinErrorFn: (nextValue) => joinError.set(nextValue),
    updateVoiceDiagnosticsFn: (updater) => diagnostics.push(typeof updater === 'function' ? updater({ session: {} }) : updater),
    setTimeoutFn: (fn) => {
      timeoutCallbacks.push(fn);
      return timeoutCallbacks.length;
    },
  });

  assert.equal(result, null);
  assert.equal(voiceE2E.value, false);
  assert.equal(warning.value, 'Voice chat is unavailable because the secure media key did not arrive in time.');
  assert.equal(joinError.value, 'Voice chat is unavailable because the secure media key did not arrive in time.');
  assert.equal(diagnostics.at(-1).session.secureVoice.state, 'waiting');
  timeoutCallbacks[0]();
  assert.equal(joinError.value, null);
});

test('voice secure diagnostics state builder keeps the shared wire shape stable', () => {
  const state = buildVoiceSecureDiagnosticsState({
    state: 'ready',
    channelId: 'channel-4',
    participantCount: 2,
    warning: null,
  });

  assert.equal(state.state, 'ready');
  assert.equal(state.channelId, 'channel-4');
  assert.equal(state.participantCount, 2);
  assert.equal(state.warning, null);
  assert.equal(typeof state.updatedAt, 'string');
});
