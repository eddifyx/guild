import test from 'node:test';
import assert from 'node:assert/strict';

import {
  handleUnexpectedVoiceSessionEnd,
  leaveVoiceChannelSession,
  runVoiceJoinRequest,
} from '../../../client/src/features/voice/voiceSessionControlFlow.mjs';

test('voice session control flow delegates a join request through the shared join flow', async () => {
  const calls = [];
  const refs = {
    joinGenRef: { current: 0 },
    channelIdRef: { current: null },
    voiceHealthProbeRetryCountRef: { current: 0 },
  };

  const result = await runVoiceJoinRequest({
    chId: 'channel-1',
    socket: { id: 'socket-1' },
    refs,
    setJoinErrorFn: (value) => calls.push(['joinError', value]),
    setE2EWarningFn: (value) => calls.push(['warning', value]),
    setLiveVoiceFallbackReasonFn: (value) => calls.push(['fallback', value]),
    recordLaneDiagnosticFn: (...args) => calls.push(args),
    runVoiceJoinFlowFn: async (payload) => {
      calls.push(['joinFlow', payload.joinGen, payload.chId]);
      return { ready: true, aborted: false };
    },
  });

  assert.deepEqual(result, { ready: true, aborted: false });
  assert.equal(refs.joinGenRef.current, 1);
  assert.deepEqual(calls.slice(0, 4), [
    ['joinError', null],
    ['warning', null],
    ['fallback', null],
    ['voice', 'join_requested', { channelId: 'channel-1' }],
  ]);
});

test('voice session control flow normalizes join failures and resets the session', async () => {
  const calls = [];
  const refs = {
    joinGenRef: { current: 2 },
    channelIdRef: { current: null },
    voiceHealthProbeRetryCountRef: { current: 0 },
  };

  const result = await runVoiceJoinRequest({
    chId: 'channel-2',
    socket: { id: 'socket-1' },
    refs,
    setJoinErrorFn: (value) => calls.push(['joinError', value]),
    setE2EWarningFn: (value) => calls.push(['warning', value]),
    setLiveVoiceFallbackReasonFn: () => {},
    recordLaneDiagnosticFn: (...args) => calls.push(args),
    runVoiceJoinFlowFn: async () => {
      throw new Error('transport broke');
    },
    resetVoiceSessionFn: async (payload) => calls.push(['reset', payload]),
    normalizeVoiceErrorMessageFn: (error) => error.message,
    scheduleClearJoinErrorFn: (callback, delayMs) => {
      calls.push(['scheduleClear', delayMs]);
      callback();
    },
    logErrorFn: (...args) => calls.push(['log', ...args]),
  });

  assert.deepEqual(result, {
    aborted: false,
    ready: false,
    error: 'transport broke',
  });
  assert.equal(calls.some((entry) => entry[0] === 'reset'), true);
  assert.equal(calls.some((entry) => entry[1] === 'join_failed'), true);
  assert.deepEqual(calls.filter((entry) => entry[0] === 'joinError'), [
    ['joinError', null],
    ['joinError', 'transport broke'],
    ['joinError', null],
  ]);
});

test('voice session control flow clears pending timers and tears down the active session on leave', async () => {
  const calls = [];
  const refs = {
    pendingLiveReconfigureRef: { current: 91 },
    pendingVoiceModeSwitchTraceRef: { current: 'trace-1' },
    joinGenRef: { current: 7 },
  };

  await leaveVoiceChannelSession({
    refs,
    setJoinErrorFn: (value) => calls.push(['joinError', value]),
    resetVoiceSessionFn: async (payload) => calls.push(['reset', payload]),
    playLeaveChimeFn: () => calls.push(['leaveChime']),
    clearTimeoutFn: (value) => calls.push(['clearTimeout', value]),
    cancelPerfTraceFn: (...args) => calls.push(['cancelTrace', ...args]),
  });

  assert.equal(refs.pendingLiveReconfigureRef.current, null);
  assert.equal(refs.pendingVoiceModeSwitchTraceRef.current, null);
  assert.equal(refs.joinGenRef.current, 8);
  assert.deepEqual(calls, [
    ['clearTimeout', 91],
    ['cancelTrace', 'trace-1', { reason: 'left-channel' }],
    ['joinError', null],
    ['reset', { notifyServer: true }],
    ['leaveChime'],
  ]);
});

test('voice session control flow handles unexpected session end only when a live voice session exists', async () => {
  const calls = [];
  let joinErrorState = null;

  const ignored = await handleUnexpectedVoiceSessionEnd('transport closed', {
    hasVoiceSession: false,
    advanceJoinGenerationFn: () => calls.push(['advance']),
    resetVoiceSessionFn: async () => calls.push(['reset']),
    setJoinErrorFn: (value) => {
      joinErrorState = typeof value === 'function' ? value(joinErrorState) : value;
      calls.push(['joinError', joinErrorState]);
    },
  });

  assert.deepEqual(ignored, { handled: false });
  assert.deepEqual(calls, []);

  const result = await handleUnexpectedVoiceSessionEnd('transport closed', {
    targetChannelId: 'channel-9',
    hasVoiceSession: true,
    advanceJoinGenerationFn: () => calls.push(['advance']),
    resetVoiceSessionFn: async (payload) => calls.push(['reset', payload]),
    setJoinErrorFn: (value) => {
      joinErrorState = typeof value === 'function' ? value(joinErrorState) : value;
      calls.push(['joinError', joinErrorState]);
    },
    setTimeoutFn: (callback, delayMs) => {
      calls.push(['timeout', delayMs]);
      callback();
    },
    sessionErrorTimeoutMs: 8000,
  });

  assert.deepEqual(result, { handled: true, joinErrorShown: true });
  assert.deepEqual(calls, [
    ['advance'],
    ['reset', { channelId: 'channel-9', notifyServer: false }],
    ['joinError', 'transport closed'],
    ['timeout', 8000],
    ['joinError', null],
  ]);
});
