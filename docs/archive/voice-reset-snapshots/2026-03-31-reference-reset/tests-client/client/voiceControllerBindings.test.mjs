import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildUseVoiceRuntimeEffectsOptions,
  buildVoiceConsumeProducerOptions,
  buildVoiceJoinRequestOptions,
  buildVoiceResetSessionOptions,
  buildVoiceScreenShareActionOptions,
  buildVoiceSessionActionOptions,
  buildVoiceUiActionOptions,
} from '../../../client/src/features/voice/voiceControllerBindings.mjs';

test('voice controller bindings build canonical reset-session options', () => {
  const refs = {
    channelIdRef: { current: 'channel-1' },
  };
  const setters = {
    setJoinErrorFn: () => {},
    setMutedFn: () => {},
  };
  const resetControlState = { muted: false, deafened: false };

  const options = buildVoiceResetSessionOptions({
    targetChannelId: 'channel-1',
    notifyServer: true,
    socket: { id: 'socket-1' },
    emitAsyncFn: () => {},
    clearVoiceHealthProbeFn: () => {},
    stopAppleVoiceCaptureFn: () => {},
    appleVoiceCaptureOwner: 'live-voice',
    refs,
    resetScreenShareAdaptationFn: () => {},
    clearVoiceKeyFn: () => {},
    setters,
    updateVoiceDiagnosticsFn: () => {},
    resetControlState,
  });

  assert.equal(options.targetChannelId, 'channel-1');
  assert.equal(options.notifyServer, true);
  assert.equal(options.refs, refs);
  assert.equal(options.setJoinErrorFn, setters.setJoinErrorFn);
  assert.equal(options.setMutedFn, setters.setMutedFn);
  assert.deepEqual(options.resetControlState, resetControlState);
});

test('voice controller bindings build canonical consume-producer options', () => {
  const refs = {
    deviceRef: { current: { id: 'device-1' } },
  };
  const runtime = {
    emitAsyncFn: () => {},
    nowIsoFn: () => '2026-03-25T00:00:00.000Z',
  };

  const options = buildVoiceConsumeProducerOptions({
    chId: 'channel-2',
    producerId: 'producer-2',
    producerUserId: 'user-2',
    source: 'microphone',
    currentUserId: 'user-1',
    refs,
    runtime,
  });

  assert.equal(options.chId, 'channel-2');
  assert.equal(options.producerId, 'producer-2');
  assert.equal(options.currentUserId, 'user-1');
  assert.equal(options.refs, refs);
  assert.equal(options.emitAsyncFn, runtime.emitAsyncFn);
  assert.equal(options.nowIsoFn, runtime.nowIsoFn);
});

test('voice controller bindings build canonical join-request options', () => {
  const refs = {
    joinGenRef: { current: 2 },
  };
  const runtime = {
    setJoinErrorFn: () => {},
    runVoiceJoinFlowFn: () => {},
    scheduleClearJoinErrorFn: () => {},
  };

  const options = buildVoiceJoinRequestOptions({
    chId: 'channel-3',
    skipConnectChime: true,
    socket: { id: 'socket-3' },
    refs,
    runtime,
  });

  assert.equal(options.chId, 'channel-3');
  assert.equal(options.skipConnectChime, true);
  assert.equal(options.socket.id, 'socket-3');
  assert.equal(options.refs, refs);
  assert.equal(options.setJoinErrorFn, runtime.setJoinErrorFn);
  assert.equal(options.runVoiceJoinFlowFn, runtime.runVoiceJoinFlowFn);
  assert.equal(options.scheduleClearJoinErrorFn, runtime.scheduleClearJoinErrorFn);
});

test('voice controller bindings build canonical session action options', () => {
  const refs = {
    channelIdRef: { current: 'channel-4' },
  };
  const setters = {
    setJoinErrorFn: () => {},
  };
  const runtime = {
    emitAsyncFn: () => {},
  };
  const constants = {
    voiceSessionErrorTimeoutMs: 8000,
  };

  const options = buildVoiceSessionActionOptions({
    socket: { id: 'socket-4' },
    refs,
    setters,
    runtime,
    constants,
  });

  assert.equal(options.socket.id, 'socket-4');
  assert.equal(options.refs, refs);
  assert.equal(options.setters, setters);
  assert.equal(options.runtime, runtime);
  assert.equal(options.constants, constants);
});

test('voice controller bindings build canonical ui action options', () => {
  const refs = {
    mutedRef: { current: false },
  };
  const setters = {
    setMutedFn: () => {},
  };
  const runtime = {
    socket: { id: 'socket-ui' },
  };

  const options = buildVoiceUiActionOptions({
    refs,
    setters,
    runtime,
  });

  assert.equal(options.refs, refs);
  assert.equal(options.setters, setters);
  assert.equal(options.runtime, runtime);
});

test('voice controller bindings build canonical screen-share action options', () => {
  const refs = {
    channelIdRef: { current: 'channel-5' },
  };
  const runtime = {
    setScreenShareErrorFn: () => {},
  };
  const constants = {
    initialProfileIndex: 0,
  };
  const getPlatformFn = () => 'darwin';
  const runVoiceScreenShareStartFlowFn = async () => {};

  const options = buildVoiceScreenShareActionOptions({
    refs,
    runtime,
    constants,
    getPlatformFn,
    runVoiceScreenShareStartFlowFn,
  });

  assert.equal(options.refs, refs);
  assert.equal(options.runtime, runtime);
  assert.equal(options.constants, constants);
  assert.equal(options.getPlatformFn, getPlatformFn);
  assert.equal(options.runVoiceScreenShareStartFlowFn, runVoiceScreenShareStartFlowFn);
});

test('voice controller bindings build canonical runtime-effects options', () => {
  const state = {
    channelId: 'channel-6',
  };
  const refs = {
    channelIdRef: { current: 'channel-6' },
  };
  const runtime = {
    socket: { id: 'socket-6' },
  };

  const options = buildUseVoiceRuntimeEffectsOptions({
    state,
    refs,
    runtime,
  });

  assert.equal(options.state, state);
  assert.equal(options.refs, refs);
  assert.equal(options.runtime, runtime);
});
