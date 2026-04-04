import test from 'node:test';
import assert from 'node:assert/strict';

import { applyAudioSettingsTestStopPrelude } from '../../../client/src/features/voice/audioSettingsTestStopPrelude.mjs';

test('audio settings test stop prelude increments the run id, clears starting state, and cancels the active frame', () => {
  const cancelledFrames = [];
  const startingStates = [];

  const testRunIdRef = { current: 7 };
  const animFrameRef = { current: 42 };

  applyAudioSettingsTestStopPrelude({
    testRunIdRef,
    animFrameRef,
    cancelAnimationFrameFn: (id) => cancelledFrames.push(id),
    setTestStartingFn: (value) => startingStates.push(value),
  });

  assert.equal(testRunIdRef.current, 8);
  assert.equal(animFrameRef.current, null);
  assert.deepEqual(cancelledFrames, [42]);
  assert.deepEqual(startingStates, [false]);
});

test('audio settings test stop prelude tolerates missing animation frames and cancel handlers', () => {
  const testRunIdRef = { current: 0 };
  const animFrameRef = { current: null };
  const startingStates = [];

  applyAudioSettingsTestStopPrelude({
    testRunIdRef,
    animFrameRef,
    cancelAnimationFrameFn: null,
    setTestStartingFn: (value) => startingStates.push(value),
  });

  assert.equal(testRunIdRef.current, 1);
  assert.equal(animFrameRef.current, null);
  assert.deepEqual(startingStates, [false]);
});
