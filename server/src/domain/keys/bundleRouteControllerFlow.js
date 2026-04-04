const { createKeysRouteControllerUploadFlow } = require('./bundleRouteControllerUploadFlow');
const { createKeysRouteControllerReadFlow } = require('./bundleRouteControllerReadFlow');
const { createKeysRouteControllerMaintenanceFlow } = require('./bundleRouteControllerMaintenanceFlow');
const { createKeysRouteControllerAccessFlow } = require('./bundleRouteControllerAccessFlow');
const { createKeysRouteControllerModel } = require('./bundleRouteControllerModel');
const { createRouteErrorHandler } = require('./bundleRouteControllerRuntime');

function createKeysRouteController({
  dbApi = {},
  verifyBundleAttestationEventFn = () => true,
  nowFn = () => Date.now(),
  bundleRateLimit = new Map(),
  targetRateLimit = new Map(),
} = {}) {
  const accessFlow = createKeysRouteControllerAccessFlow({
    dbApi,
    nowFn,
    bundleRateLimit,
    targetRateLimit,
  });
  const model = createKeysRouteControllerModel(dbApi);

  const uploadFlow = createKeysRouteControllerUploadFlow({
    dbApi,
    model,
    verifyBundleAttestationEventFn,
  });
  const readFlow = createKeysRouteControllerReadFlow({
    model,
    accessFlow,
  });
  const maintenanceFlow = createKeysRouteControllerMaintenanceFlow({
    model,
    dbApi,
  });

  return {
    uploadBundle: createRouteErrorHandler(
      'Error uploading prekey bundle:',
      'Failed to upload prekey bundle',
      uploadFlow.handleUploadBundle,
    ),
    getDeviceIdentities: createRouteErrorHandler(
      'Error fetching device identities:',
      'Failed to fetch device identities',
      readFlow.handleDeviceIdentities,
    ),
    getDeviceBundle: createRouteErrorHandler(
      'Error fetching device prekey bundle:',
      'Failed to fetch device prekey bundle',
      readFlow.handleDeviceBundle,
    ),
    getPreferredUserBundle: createRouteErrorHandler(
      'Error fetching prekey bundle:',
      'Failed to fetch prekey bundle',
      readFlow.handlePreferredUserBundle,
    ),
    getStableIdentityRecord: createRouteErrorHandler(
      'Error fetching identity record:',
      'Failed to fetch identity record',
      readFlow.handleStableIdentityRecord,
    ),
    countOTPs: createRouteErrorHandler(
      'Error counting OTPs:',
      'Failed to count OTPs',
      maintenanceFlow.handleCount(model.countAvailableOTPs, model.countAvailableDeviceOTPs),
    ),
    countKyberPreKeys: createRouteErrorHandler(
      'Error counting Kyber prekeys:',
      'Failed to count Kyber prekeys',
      maintenanceFlow.handleCount(model.countAvailableKyberPreKeys, model.countAvailableDeviceKyberPreKeys),
    ),
    replenishOneTimePreKeys: createRouteErrorHandler(
      'Error replenishing OTPs:',
      'Failed to replenish OTPs',
      maintenanceFlow.handleReplenishOneTime,
    ),
    replenishKyberPreKeys: createRouteErrorHandler(
      'Error replenishing Kyber prekeys:',
      'Failed to replenish Kyber prekeys',
      maintenanceFlow.handleReplenishKyber,
    ),
    resetKeys: createRouteErrorHandler(
      'Error resetting user keys:',
      'Failed to reset keys',
      maintenanceFlow.handleReset,
    ),
  };
}

module.exports = {
  createKeysRouteController,
};
