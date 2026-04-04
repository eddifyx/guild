const {
  getRequestedDeviceId,
} = require('./bundleFlow');
const {
  replenishKyberPreKeys,
  replenishOneTimePreKeys,
} = require('./bundleMaintenanceFlow');
const {
  isValidBase64KeyRange,
} = require('./bundleUploadFlow');
const {
  resetBundleKeys,
} = require('./bundleWriteFlow');
const { sendRouteResult } = require('./bundleRouteControllerRuntime');

function createKeysRouteControllerMaintenanceFlow({
  model = {},
  dbApi = {},
} = {}) {
  function handleCount(countAvailableKeysFn, countAvailableDeviceKeysFn) {
    return (req, res) => {
      const result = {
        body: {
          count: countAvailableDeviceKeysFn && getRequestedDeviceId(req)
            ? (countAvailableDeviceKeysFn(req.userId, getRequestedDeviceId(req))?.count ?? 0)
            : (countAvailableKeysFn(req.userId)?.count ?? 0),
        },
      };

      return res.json(result.body);
    };
  }

  function handleReplenishOneTime(req, res) {
    const replenishResult = replenishOneTimePreKeys({
      userId: req.userId,
      deviceId: getRequestedDeviceId(req),
      oneTimePreKeys: req.body.oneTimePreKeys,
      countAvailableKeysFn: model.countAvailableOTPs,
      countAvailableDeviceKeysFn: model.countAvailableDeviceOTPs,
      insertOneTimePreKeyFn: model.insertOneTimePreKey,
      insertDeviceOneTimePreKeyFn: model.insertDeviceOneTimePreKey,
      isValidBase64KeyRangeFn: isValidBase64KeyRange,
    });

    return sendRouteResult(res, replenishResult);
  }

  function handleReplenishKyber(req, res) {
    const replenishResult = replenishKyberPreKeys({
      userId: req.userId,
      deviceId: getRequestedDeviceId(req),
      kyberPreKeys: req.body.kyberPreKeys,
      countAvailableKeysFn: model.countAvailableKyberPreKeys,
      countAvailableDeviceKeysFn: model.countAvailableDeviceKyberPreKeys,
      insertKyberPreKeyFn: model.insertKyberPreKey,
      insertDeviceKyberPreKeyFn: model.insertDeviceKyberPreKey,
    });

    return sendRouteResult(res, replenishResult);
  }

  function handleReset(req, res) {
    return res.json(resetBundleKeys({
      userId: req.userId,
      resetUserKeysFn: model.resetUserKeys,
    }));
  }

  return {
    handleCount,
    handleReplenishOneTime,
    handleReplenishKyber,
    handleReset,
  };
}

module.exports = {
  createKeysRouteControllerMaintenanceFlow,
};
