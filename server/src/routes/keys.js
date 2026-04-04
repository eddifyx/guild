const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const dbApi = require('../db');
const { createKeysRouteController } = require('../domain/keys/bundleRouteControllerFlow');
const { verifyBundleAttestationEvent } = require('../utils/bundleAttestation');

router.use(authMiddleware);

const keysRoute = createKeysRouteController({
  dbApi,
  verifyBundleAttestationEventFn: verifyBundleAttestationEvent,
});

router.post('/bundle', keysRoute.uploadBundle);
router.get('/identities/:userId', keysRoute.getDeviceIdentities);
router.get('/bundle/:userId/:deviceId', keysRoute.getDeviceBundle);
router.get('/bundle/:userId', keysRoute.getPreferredUserBundle);
router.get('/identity/:userId', keysRoute.getStableIdentityRecord);
router.get('/count', keysRoute.countOTPs);
router.get('/count-kyber', keysRoute.countKyberPreKeys);
router.post('/replenish', keysRoute.replenishOneTimePreKeys);
router.post('/replenish-kyber', keysRoute.replenishKyberPreKeys);
router.delete('/reset', keysRoute.resetKeys);

module.exports = router;
