import test from 'node:test';
import assert from 'node:assert/strict';

import { startVoiceVadRuntime } from '../../../client/src/features/voice/voiceVadRuntime.mjs';

function createAnalyser({
  frequencyFrames = [],
  timeFrames = [],
} = {}) {
  let frameIndex = 0;
  return {
    fftSize: 0,
    smoothingTimeConstant: 0,
    frequencyBinCount: 4,
    getByteFrequencyData(target) {
      const source = frequencyFrames[Math.min(frameIndex, frequencyFrames.length - 1)] || [0, 0, 0, 0];
      target.set(source);
    },
    getByteTimeDomainData(target) {
      const source = timeFrames[Math.min(frameIndex, timeFrames.length - 1)] || new Array(target.length).fill(128);
      target.set(source);
      frameIndex += 1;
    },
  };
}

test('voice VAD runtime clears the previous interval and resets speaking when no gain node context exists', () => {
  const cleared = [];
  const speakingStates = [];

  const intervalId = startVoiceVadRuntime({
    currentVadIntervalId: 12,
    clearIntervalFn: (value) => cleared.push(value),
    gainNode: null,
    setSpeakingFn: (value) => speakingStates.push(value),
  });

  assert.equal(intervalId, null);
  assert.deepEqual(cleared, [12]);
  assert.deepEqual(speakingStates, [false]);
});

test('voice VAD runtime emits speaking true after sustained audio activity', () => {
  const speakingStates = [];
  const emitted = [];
  let intervalCallback = null;

  const analyser = createAnalyser({
    frequencyFrames: [
      [0, 24, 24, 24],
      [0, 28, 28, 28],
      [0, 32, 32, 32],
    ],
    timeFrames: [
      [128, 150, 105, 146, 110, 145, 108, 149],
      [128, 152, 102, 148, 106, 147, 104, 151],
      [128, 154, 100, 150, 104, 149, 102, 153],
    ],
  });

  const intervalId = startVoiceVadRuntime({
    gainNode: {
      context: {
        createAnalyser: () => analyser,
      },
      connect: () => {},
    },
    warmupFrames: 0,
    channelIdRef: { current: 'channel-1' },
    socket: {
      emit(eventName, payload) {
        emitted.push([eventName, payload]);
      },
    },
    setSpeakingFn: (value) => speakingStates.push(value),
    setIntervalFn: (callback) => {
      intervalCallback = callback;
      return 99;
    },
  });

  assert.equal(intervalId, 99);
  intervalCallback();
  intervalCallback();
  intervalCallback();

  assert.deepEqual(speakingStates, [true]);
  assert.deepEqual(emitted, [[
    'voice:speaking',
    { channelId: 'channel-1', speaking: true },
  ]]);
});

test('voice VAD runtime emits speaking false when a muted user was previously speaking', () => {
  const speakingStates = [];
  const emitted = [];
  let intervalCallback = null;
  const mutedRef = { current: false };

  const analyser = createAnalyser({
    frequencyFrames: [
      [0, 30, 30, 30],
      [0, 34, 34, 34],
      [0, 36, 36, 36],
    ],
    timeFrames: [
      [128, 150, 105, 146, 110, 145, 108, 149],
      [128, 152, 102, 148, 106, 147, 104, 151],
      [128, 154, 100, 150, 104, 149, 102, 153],
    ],
  });

  startVoiceVadRuntime({
    gainNode: {
      context: {
        createAnalyser: () => analyser,
      },
      connect: () => {},
    },
    warmupFrames: 0,
    mutedRef,
    channelIdRef: { current: 'channel-2' },
    socket: {
      emit(eventName, payload) {
        emitted.push([eventName, payload]);
      },
    },
    setSpeakingFn: (value) => speakingStates.push(value),
    setIntervalFn: (callback) => {
      intervalCallback = callback;
      return 42;
    },
  });

  intervalCallback();
  intervalCallback();
  intervalCallback();
  mutedRef.current = true;
  intervalCallback();

  assert.deepEqual(speakingStates, [true, false]);
  assert.deepEqual(emitted, [
    ['voice:speaking', { channelId: 'channel-2', speaking: true }],
    ['voice:speaking', { channelId: 'channel-2', speaking: false }],
  ]);
});

test('voice VAD runtime does not latch speaking on steady low noise', () => {
  const speakingStates = [];
  const emitted = [];
  let intervalCallback = null;

  const analyser = createAnalyser({
    frequencyFrames: new Array(12).fill([0, 4, 5, 4]),
    timeFrames: new Array(12).fill([128, 130, 127, 129, 128, 129, 127, 128]),
  });

  startVoiceVadRuntime({
    analysisNode: {
      context: {
        createAnalyser: () => analyser,
      },
      connect: () => {},
    },
    channelIdRef: { current: 'channel-3' },
    socket: {
      emit(eventName, payload) {
        emitted.push([eventName, payload]);
      },
    },
    setSpeakingFn: (value) => speakingStates.push(value),
    setIntervalFn: (callback) => {
      intervalCallback = callback;
      return 77;
    },
  });

  for (let index = 0; index < 12; index += 1) {
    intervalCallback();
  }

  assert.deepEqual(speakingStates, []);
  assert.deepEqual(emitted, []);
});

test('voice VAD runtime still activates after quiet warmup followed by moderate speech', () => {
  const speakingStates = [];
  const emitted = [];
  let intervalCallback = null;

  const analyser = createAnalyser({
    frequencyFrames: [
      [0, 4, 5, 4],
      [0, 4, 5, 4],
      [0, 4, 5, 4],
      [0, 4, 5, 4],
      [0, 4, 5, 4],
      [0, 4, 5, 4],
      [0, 10, 11, 10],
      [0, 10, 11, 10],
      [0, 10, 11, 10],
      [0, 10, 11, 10],
      [0, 10, 11, 10],
      [0, 10, 11, 10],
    ],
    timeFrames: [
      [128, 130, 127, 129, 128, 129, 127, 128],
      [128, 130, 127, 129, 128, 129, 127, 128],
      [128, 130, 127, 129, 128, 129, 127, 128],
      [128, 130, 127, 129, 128, 129, 127, 128],
      [128, 130, 127, 129, 128, 129, 127, 128],
      [128, 130, 127, 129, 128, 129, 127, 128],
      [128, 138, 118, 136, 120, 135, 121, 137],
      [128, 138, 118, 136, 120, 135, 121, 137],
      [128, 138, 118, 136, 120, 135, 121, 137],
      [128, 138, 118, 136, 120, 135, 121, 137],
      [128, 138, 118, 136, 120, 135, 121, 137],
      [128, 138, 118, 136, 120, 135, 121, 137],
    ],
  });

  startVoiceVadRuntime({
    analysisNode: {
      context: {
        createAnalyser: () => analyser,
      },
      connect: () => {},
    },
    channelIdRef: { current: 'channel-4' },
    socket: {
      emit(eventName, payload) {
        emitted.push([eventName, payload]);
      },
    },
    setSpeakingFn: (value) => speakingStates.push(value),
    setIntervalFn: (callback) => {
      intervalCallback = callback;
      return 55;
    },
  });

  for (let index = 0; index < 12; index += 1) {
    intervalCallback();
  }

  assert.deepEqual(speakingStates, [true]);
  assert.deepEqual(emitted, [[
    'voice:speaking',
    { channelId: 'channel-4', speaking: true },
  ]]);
});
