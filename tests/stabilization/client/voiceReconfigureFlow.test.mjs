import test from 'node:test';
import assert from 'node:assert/strict';

import {
  reconfigureVoiceLiveCapture,
  scheduleVoiceHealthProbeFlow,
  scheduleVoiceLiveReconfigureFlow,
} from '../../../client/src/features/voice/voiceReconfigureFlow.mjs';

test('voice reconfigure flow cancels when there is no active channel', async () => {
  const calls = [];
  await reconfigureVoiceLiveCapture({
    refs: {
      channelIdRef: { current: null },
      pendingVoiceModeSwitchTraceRef: { current: 'trace-1' },
    },
    perfTraceId: 'trace-1',
    cancelPerfTraceFn: (...args) => calls.push(['cancel', ...args]),
  });

  assert.deepEqual(calls, [['cancel', 'trace-1', { reason: 'no-active-channel' }]]);
});

test('voice reconfigure flow normalizes apply failures into perf trace errors', async () => {
  const calls = [];
  await reconfigureVoiceLiveCapture({
    refs: {
      channelIdRef: { current: 'channel-1' },
      pendingVoiceModeSwitchTraceRef: { current: 'trace-2' },
    },
    perfTraceId: 'trace-2',
    addPerfPhaseFn: (...args) => calls.push(['phase', ...args]),
    endPerfTraceFn: (...args) => calls.push(['end', ...args]),
    applyLiveCaptureToProducerFn: async () => {
      throw new Error('capture-failed');
    },
    normalizeVoiceErrorMessageFn: (error) => error.message,
    warnFn: (...args) => calls.push(['warn', ...args]),
  });

  assert.equal(calls.some((entry) => entry[0] === 'phase'), true);
  assert.deepEqual(calls.find((entry) => entry[0] === 'end'), [
    'end',
    'trace-2',
    { status: 'error', error: 'capture-failed' },
  ]);
});

test('voice reconfigure flow schedules health probes and reschedules when the probe requests it', async () => {
  const calls = [];
  let scheduledCallback = null;
  const refs = {
    voiceHealthProbeTimeoutRef: { current: null },
    channelIdRef: { current: 'channel-2' },
    mutedRef: { current: false },
    producerRef: { current: { id: 'producer-1' } },
    voiceHealthProbeRetryCountRef: { current: 0 },
  };

  scheduleVoiceHealthProbeFlow({
    chId: 'channel-2',
    refs,
    clearVoiceHealthProbeFn: () => calls.push(['clear']),
    setTimeoutFn: (callback, delayMs) => {
      calls.push(['setTimeout', delayMs]);
      scheduledCallback = callback;
      return 99;
    },
    runVoiceHealthProbeCheckFn: async () => ({ shouldReschedule: true }),
    reconfigureLiveCaptureFn: async () => {},
    rescheduleFn: (...args) => calls.push(['reschedule', ...args]),
  });

  assert.equal(refs.voiceHealthProbeTimeoutRef.current, 99);
  await scheduledCallback();
  assert.deepEqual(calls, [
    ['clear'],
    ['setTimeout', 2500],
    ['reschedule', 'channel-2', { delayMs: 2500, reason: 'post-reconfigure' }],
  ]);
});

test('voice reconfigure flow schedules live reconfigure work and aborts when the channel ends', async () => {
  const calls = [];
  let scheduledCallback = null;
  const refs = {
    channelIdRef: { current: 'channel-3' },
    pendingLiveReconfigureRef: { current: 41 },
    pendingVoiceModeSwitchTraceRef: { current: 'trace-3' },
  };

  scheduleVoiceLiveReconfigureFlow({
    perfTraceId: 'trace-3',
    refs,
    clearTimeoutFn: (value) => calls.push(['clearTimeout', value]),
    setTimeoutFn: (callback) => {
      scheduledCallback = callback;
      return 42;
    },
    addPerfPhaseFn: (...args) => calls.push(['phase', ...args]),
    cancelPerfTraceFn: (...args) => calls.push(['cancel', ...args]),
    reconfigureLiveCaptureFn: async (...args) => calls.push(['reconfigure', ...args]),
  });

  assert.equal(refs.pendingLiveReconfigureRef.current, 42);
  refs.channelIdRef.current = null;
  scheduledCallback();

  assert.deepEqual(calls, [
    ['clearTimeout', 41],
    ['phase', 'trace-3', 'queued'],
    ['cancel', 'trace-3', { reason: 'channel-ended-before-reconfigure' }],
  ]);
});
