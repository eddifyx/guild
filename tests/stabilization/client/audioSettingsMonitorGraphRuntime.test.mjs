import test from 'node:test';
import assert from 'node:assert/strict';

import { attachAudioSettingsMonitorGraph } from '../../../client/src/features/voice/audioSettingsMonitorGraphRuntime.mjs';

function createFakeMonitorContext() {
  const log = [];

  const ctx = {
    createGain() {
      return {
        gain: { value: 0 },
        connect: (...args) => log.push(['monitorGain.connect', ...args]),
      };
    },
  };

  const gainNode = {
    connect: (...args) => log.push(['gainNode.connect', ...args]),
  };

  return { ctx, gainNode, log };
}

test('audio settings monitor graph runtime wires the monitor tap directly from the gained signal and stores the gain ref', () => {
  const { ctx, gainNode, log } = createFakeMonitorContext();
  const monitorGainRef = { current: null };

  const { monitorGain } = attachAudioSettingsMonitorGraph({
    ctx,
    gainNode,
    monitorProfile: { gain: 0.65 },
    monitorGainRef,
  });

  assert.equal(monitorGain.gain.value, 0.65);
  assert.equal(monitorGainRef.current, monitorGain);
  assert.deepEqual(log, [
    ['gainNode.connect', monitorGain],
  ]);
});
