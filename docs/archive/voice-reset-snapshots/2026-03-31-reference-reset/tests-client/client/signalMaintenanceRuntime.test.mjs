import test from 'node:test';
import assert from 'node:assert/strict';

import {
  checkAndReplenishKyberPreKeys,
  checkAndReplenishOneTimePreKeys,
  runSignalKeyMaintenance,
  scheduleSignalKeyMaintenance,
  SIGNAL_KEY_MAINTENANCE_INTERVAL_MS,
} from '../../../client/src/features/crypto/signalMaintenanceRuntime.mjs';

test('signal maintenance runtime schedules one interval and runs only while initialized', async () => {
  const calls = [];
  const interval = scheduleSignalKeyMaintenance({
    existingIntervalId: 'old-interval',
    clearIntervalFn: (value) => calls.push(['clear', value]),
    setIntervalFn: (callback, delayMs) => {
      calls.push(['set', delayMs]);
      callback();
      return 'new-interval';
    },
    isInitializedFn: () => true,
    runMaintenanceFn: async () => calls.push(['run']),
  });

  assert.equal(interval, 'new-interval');
  assert.deepEqual(calls, [
    ['clear', 'old-interval'],
    ['set', SIGNAL_KEY_MAINTENANCE_INTERVAL_MS],
    ['run'],
  ]);
});

test('signal maintenance runtime replenishes one-time prekeys only below threshold', async () => {
  const uploads = [];
  const changed = await checkAndReplenishOneTimePreKeys({
    deviceId: 7,
    getCountFn: async () => ({ count: 4 }),
    replenishLocalKeysFn: async (count) => ({ generated: count }),
    uploadKeysFn: async (payload, deviceId) => uploads.push([payload, deviceId]),
    threshold: 20,
    targetCount: 100,
  });

  assert.equal(changed, true);
  assert.deepEqual(uploads, [[{ generated: 96 }, 7]]);

  const unchanged = await checkAndReplenishOneTimePreKeys({
    blockedReason: 'paused',
    getCountFn: async () => ({ count: 0 }),
    replenishLocalKeysFn: async () => {
      throw new Error('should not run');
    },
    uploadKeysFn: async () => {
      throw new Error('should not run');
    },
  });

  assert.equal(unchanged, false);
});

test('signal maintenance runtime replenishes kyber prekeys with the configured batch size', async () => {
  const uploads = [];
  const changed = await checkAndReplenishKyberPreKeys({
    deviceId: 9,
    getCountFn: async () => ({ count: 1 }),
    replenishLocalKeysFn: async (count) => ({ generated: count }),
    uploadKeysFn: async (payload, deviceId) => uploads.push([payload, deviceId]),
    threshold: 5,
    batchSize: 20,
  });

  assert.equal(changed, true);
  assert.deepEqual(uploads, [[{ generated: 20 }, 9]]);
});

test('signal maintenance runtime runs one maintenance pass immediately and reports failures safely', async () => {
  const calls = [];

  const changed = await runSignalKeyMaintenance({
    runMaintenanceFn: async () => {
      calls.push('run');
    },
  });

  assert.equal(changed, true);
  assert.deepEqual(calls, ['run']);

  const failed = await runSignalKeyMaintenance({
    runMaintenanceFn: async () => {
      throw new Error('maintenance failed');
    },
    logErrorFn: (message, err) => {
      calls.push([message, err.message]);
    },
  });

  assert.equal(failed, false);
  assert.deepEqual(calls.at(-1), ['[Signal] Key maintenance error:', 'maintenance failed']);
});
