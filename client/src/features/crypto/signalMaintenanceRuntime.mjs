export const SIGNAL_KEY_MAINTENANCE_INTERVAL_MS = 5 * 60 * 1000;

export function scheduleSignalKeyMaintenance({
  existingIntervalId = null,
  isInitializedFn = () => false,
  runMaintenanceFn,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
  logErrorFn = console.error,
  intervalMs = SIGNAL_KEY_MAINTENANCE_INTERVAL_MS,
} = {}) {
  if (existingIntervalId) {
    clearIntervalFn(existingIntervalId);
  }

  return setIntervalFn(async () => {
    if (!isInitializedFn()) return;
    try {
      await runMaintenanceFn?.();
    } catch (err) {
      logErrorFn('[Signal] Key maintenance error:', err);
    }
  }, intervalMs);
}

export async function runSignalKeyMaintenance({
  runMaintenanceFn,
  logErrorFn = console.error,
} = {}) {
  try {
    await runMaintenanceFn?.();
    return true;
  } catch (err) {
    logErrorFn('[Signal] Key maintenance error:', err);
    return false;
  }
}

export async function checkAndReplenishOneTimePreKeys({
  blockedReason = null,
  deviceId = 1,
  getCountFn,
  replenishLocalKeysFn,
  uploadKeysFn,
  threshold = 20,
  targetCount = 100,
  logErrorFn = console.error,
} = {}) {
  if (blockedReason) return false;
  try {
    const response = await getCountFn?.(deviceId);
    const count = Number(response?.count) || 0;
    if (count >= threshold) {
      return false;
    }
    const newKeys = await replenishLocalKeysFn?.(targetCount - count);
    await uploadKeysFn?.(newKeys, deviceId);
    return true;
  } catch (err) {
    logErrorFn('[Signal] OTP replenishment failed:', err);
    return false;
  }
}

export async function checkAndReplenishKyberPreKeys({
  blockedReason = null,
  deviceId = 1,
  getCountFn,
  replenishLocalKeysFn,
  uploadKeysFn,
  threshold = 5,
  batchSize = 20,
  logErrorFn = console.error,
} = {}) {
  if (blockedReason) return false;
  try {
    const response = await getCountFn?.(deviceId);
    const count = Number(response?.count) || 0;
    if (count >= threshold) {
      return false;
    }
    const newKeys = await replenishLocalKeysFn?.(batchSize);
    await uploadKeysFn?.(newKeys, deviceId);
    return true;
  } catch (err) {
    logErrorFn('[Signal] Kyber replenishment failed:', err);
    return false;
  }
}
