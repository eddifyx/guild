import test from 'node:test';
import assert from 'node:assert/strict';

import { createSignalClientMaintenanceRuntime } from '../../../client/src/features/crypto/signalClientMaintenanceRuntime.mjs';

test('signal client maintenance runtime schedules and runs both replenishment lanes with canonical state', async () => {
  const calls = [];
  let maintenanceInterval = null;
  let runMaintenance = null;

  const runtime = createSignalClientMaintenanceRuntime({
    getMaintenanceIntervalFn: () => maintenanceInterval,
    setMaintenanceIntervalFn: (nextIntervalId) => {
      maintenanceInterval = nextIntervalId;
    },
    isInitializedFn: () => true,
    getOutboundSignalBlockedReasonFn: () => 'recovering',
    getCurrentDeviceIdFn: () => 9,
    getOTPCountFn: async () => 3,
    replenishOTPsFn: async () => {},
    uploadOTPsFn: async () => {},
    getKyberCountFn: async () => 2,
    replenishKyberFn: async () => {},
    uploadKyberFn: async () => {},
    checkAndReplenishOneTimePreKeysFn: async (options) => {
      calls.push(['otp', options]);
      return { replenished: true };
    },
    checkAndReplenishKyberPreKeysFn: async (options) => {
      calls.push(['kyber', options]);
      return { replenished: true };
    },
    scheduleSignalKeyMaintenanceFn: ({ runMaintenanceFn }) => {
      calls.push(['schedule']);
      runMaintenance = runMaintenanceFn;
      return 'interval-1';
    },
  });

  const nextIntervalId = runtime.scheduleKeyMaintenance();
  await runMaintenance();

  assert.equal(nextIntervalId, 'interval-1');
  assert.equal(maintenanceInterval, 'interval-1');
  assert.equal(calls[0][0], 'schedule');
  assert.equal(calls[1][0], 'otp');
  assert.equal(calls[1][1].blockedReason, 'recovering');
  assert.equal(calls[1][1].deviceId, 9);
  assert.equal(calls[2][0], 'kyber');
  assert.equal(calls[2][1].deviceId, 9);
});
