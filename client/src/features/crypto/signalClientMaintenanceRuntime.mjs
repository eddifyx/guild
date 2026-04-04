import {
  checkAndReplenishKyberPreKeys,
  checkAndReplenishOneTimePreKeys,
  runSignalKeyMaintenance,
  scheduleSignalKeyMaintenance,
} from './signalMaintenanceRuntime.mjs';

export function createSignalClientMaintenanceRuntime({
  getMaintenanceIntervalFn = () => null,
  setMaintenanceIntervalFn = () => {},
  isInitializedFn = () => false,
  getOutboundSignalBlockedReasonFn = () => null,
  getCurrentDeviceIdFn = () => 1,
  getOTPCountFn,
  replenishOTPsFn,
  uploadOTPsFn,
  getKyberCountFn,
  replenishKyberFn,
  uploadKyberFn,
  otpThreshold = 20,
  kyberThreshold = 5,
  kyberBatchSize = 20,
  checkAndReplenishOneTimePreKeysFn = checkAndReplenishOneTimePreKeys,
  checkAndReplenishKyberPreKeysFn = checkAndReplenishKyberPreKeys,
  runSignalKeyMaintenanceFn = runSignalKeyMaintenance,
  scheduleSignalKeyMaintenanceFn = scheduleSignalKeyMaintenance,
} = {}) {
  async function checkAndReplenishOTPs() {
    return checkAndReplenishOneTimePreKeysFn({
      blockedReason: getOutboundSignalBlockedReasonFn?.(),
      deviceId: getCurrentDeviceIdFn?.(),
      getCountFn: getOTPCountFn,
      replenishLocalKeysFn: replenishOTPsFn,
      uploadKeysFn: uploadOTPsFn,
      threshold: otpThreshold,
    });
  }

  async function checkAndReplenishKyber() {
    return checkAndReplenishKyberPreKeysFn({
      blockedReason: getOutboundSignalBlockedReasonFn?.(),
      deviceId: getCurrentDeviceIdFn?.(),
      getCountFn: getKyberCountFn,
      replenishLocalKeysFn: replenishKyberFn,
      uploadKeysFn: uploadKyberFn,
      threshold: kyberThreshold,
      batchSize: kyberBatchSize,
    });
  }

  function scheduleKeyMaintenance() {
    const nextIntervalId = scheduleSignalKeyMaintenanceFn({
      existingIntervalId: getMaintenanceIntervalFn?.(),
      isInitializedFn,
      runMaintenanceFn: runKeyMaintenanceNow,
    });
    setMaintenanceIntervalFn(nextIntervalId);
    return nextIntervalId;
  }

  async function runKeyMaintenanceNow() {
    return runSignalKeyMaintenanceFn({
      runMaintenanceFn: async () => {
        await checkAndReplenishOTPs();
        await checkAndReplenishKyber();
      },
    });
  }

  return {
    checkAndReplenishOTPs,
    checkAndReplenishKyber,
    runKeyMaintenanceNow,
    scheduleKeyMaintenance,
  };
}
