/**
 * /guild E2E Encryption - Signal Client (v2 IPC Wrapper)
 *
 * Thin async wrapper around window.signalCrypto exposed by preload.js.
 * All key material stays in the Electron main process (Rust native memory).
 * The renderer only sends plaintext and receives opaque ciphertext blobs.
 */

import {
  uploadPreKeyBundle,
  fetchPreKeyBundle,
  fetchIdentityAttestation,
  replenishOTPs as apiReplenishOTPs,
  replenishKyberPreKeys as apiReplenishKyber,
  resetEncryptionKeys,
} from '../api.js';
import {
  loadCachedBundleAttestation,
  signBundleAttestation,
  storeBundleAttestation,
  verifyBundleAttestation,
} from './bundleAttestation.js';
import { getKnownNpub } from './identityDirectory.js';

const OTP_REPLENISH_THRESHOLD = 20;
const KYBER_REPLENISH_THRESHOLD = 5;
const KYBER_BATCH_SIZE = 20;
const PREKEY_MESSAGE_TYPE = 3;
const REMOTE_IDENTITY_CACHE_TTL_MS = 10000;

const remoteIdentityCache = new Map();
const sessionBootstrapRecipients = new Set();

let _initialized = false;
let _userId = null;
let _initPromise = null;
let _maintenanceInterval = null;

async function getStableLocalBundle() {
  const bundle = await window.signalCrypto.getBundle();
  return {
    identityKey: bundle.identityKey,
    registrationId: bundle.registrationId,
    signedPreKey: bundle.signedPreKey,
  };
}

async function getLocalBundleAttestation(authData, stableBundle) {
  const cached = loadCachedBundleAttestation(authData.userId, stableBundle, authData.npub);
  if (cached) return cached;

  const signed = await signBundleAttestation(stableBundle);
  storeBundleAttestation(authData.userId, signed);
  return signed;
}

async function uploadSignedBundle(authData) {
  const otpCount = await window.signalCrypto.otpCount();
  if (otpCount < OTP_REPLENISH_THRESHOLD) {
    await window.signalCrypto.replenishOTPs(100 - otpCount);
  }

  const kyberCount = await window.signalCrypto.kyberCount();
  if (kyberCount < KYBER_REPLENISH_THRESHOLD) {
    await window.signalCrypto.replenishKyber(Math.max(KYBER_BATCH_SIZE, 20) - kyberCount);
  }

  const fullBundle = await window.signalCrypto.getBundle();
  const stableBundle = {
    identityKey: fullBundle.identityKey,
    registrationId: fullBundle.registrationId,
    signedPreKey: fullBundle.signedPreKey,
  };
  const bundleSignatureEvent = await getLocalBundleAttestation(authData, stableBundle);

  await uploadPreKeyBundle({
    ...fullBundle,
    bundleSignatureEvent,
  });
}

async function resolveExpectedNpub(userId) {
  const known = getKnownNpub(userId);
  if (known) return known;
  const err = new Error('Secure messaging is waiting for this contact\'s Nostr identity.');
  err.retryable = true;
  throw err;
}

async function requireTrustedNpub(userId, { quarantineSession = false } = {}) {
  try {
    return await resolveExpectedNpub(userId);
  } catch (err) {
    if (quarantineSession) {
      try {
        await window.signalCrypto.deleteSession(userId);
      } catch {}
    }
    throw err;
  }
}
function getStableBundle(identityRecord) {
  return {
    identityKey: identityRecord.identityKey,
    registrationId: identityRecord.registrationId,
    signedPreKey: identityRecord.signedPreKey,
  };
}

async function validateIdentityAttestation(userId, identityRecord) {
  const expectedNpub = await resolveExpectedNpub(userId);
  const stableBundle = getStableBundle(identityRecord);

  if (!identityRecord.bundleSignatureEvent) {
    throw new Error('Remote Signal identity is missing a Nostr attestation');
  }

  if (!verifyBundleAttestation(stableBundle, identityRecord.bundleSignatureEvent, expectedNpub)) {
    throw new Error('Remote Signal identity attestation is invalid');
  }

  return { expectedNpub, stableBundle };
}

async function reconcileAttestedIdentity(userId, identityKey) {
  let trustState = await window.signalCrypto.getIdentityState(userId, identityKey);
  const rotated = trustState?.status === 'key_changed';

  if (rotated) {
    await window.signalCrypto.deleteSession(userId);
    await window.signalCrypto.approveIdentity(userId, identityKey, { verified: false });
    trustState = await window.signalCrypto.getIdentityState(userId, identityKey);
  } else if (trustState?.status !== 'trusted') {
    await window.signalCrypto.approveIdentity(userId, identityKey, { verified: false });
    trustState = await window.signalCrypto.getIdentityState(userId, identityKey);
  }

  return {
    status: trustState?.status || 'trusted',
    verified: !!trustState?.verified,
    rotated,
  };
}

async function verifyAndApproveIdentity(userId, identityRecord) {
  const { stableBundle } = await validateIdentityAttestation(userId, identityRecord);
  const trustState = await reconcileAttestedIdentity(userId, stableBundle.identityKey);

  return {
    ...stableBundle,
    trustState: trustState.status,
    verified: trustState.verified,
    rotated: trustState.rotated,
  };
}

async function fetchIdentityAttestationCached(userId, { force = false } = {}) {
  const cached = remoteIdentityCache.get(userId);
  const now = Date.now();

  if (!force && cached?.value && cached.expiresAt > now) {
    return cached.value;
  }

  if (!force && cached?.promise) {
    return cached.promise;
  }

  const promise = fetchIdentityAttestation(userId)
    .then((identity) => {
      remoteIdentityCache.set(userId, {
        value: identity,
        expiresAt: Date.now() + REMOTE_IDENTITY_CACHE_TTL_MS,
      });
      return identity;
    })
    .catch((err) => {
      if (remoteIdentityCache.get(userId)?.promise === promise) {
        remoteIdentityCache.delete(userId);
      }
      throw err;
    });

  remoteIdentityCache.set(userId, { promise });
  return promise;
}

async function fetchVerifiedIdentity(userId) {
  const identity = await fetchIdentityAttestationCached(userId);
  await verifyAndApproveIdentity(userId, identity);
  return identity;
}

async function fetchVerifiedPreKeyBundle(userId) {
  const bundle = await fetchPreKeyBundle(userId);
  await verifyAndApproveIdentity(userId, bundle);
  return bundle;
}

async function bootstrapSessionFromVerifiedBundle(recipientId, { force = false } = {}) {
  if (force) {
    try {
      await window.signalCrypto.deleteSession(recipientId);
    } catch {}
  }

  const bundle = await fetchVerifiedPreKeyBundle(recipientId);
  await window.signalCrypto.processBundle(recipientId, bundle);
}

export async function initializeSignalCrypto(authData) {
  if (_initialized && _userId === authData.userId) return;
  if (_initPromise) return _initPromise;
  _initPromise = _doInit(authData).finally(() => { _initPromise = null; });
  return _initPromise;
}

async function _doInit(authData) {
  if (!window.signalCrypto) {
    throw new Error('Signal crypto not available (requires Electron)');
  }

  const result = await window.signalCrypto.initialize(authData.userId);

  try {
    await uploadSignedBundle(authData);
  } catch (err) {
    if (result.isNew && err.message?.includes('rotation')) {
      console.warn('[Signal] Key mismatch - resetting server keys');
      await resetEncryptionKeys();
      await uploadSignedBundle(authData, true);
    } else {
      throw err;
    }
  }

  _initialized = true;
  _userId = authData.userId;
  remoteIdentityCache.clear();
  sessionBootstrapRecipients.clear();
  scheduleKeyMaintenance();
}

export async function destroySignalCrypto() {
  if (_maintenanceInterval) {
    clearInterval(_maintenanceInterval);
    _maintenanceInterval = null;
  }
  if (window.signalCrypto) {
    await window.signalCrypto.destroy();
  }
  _initialized = false;
  _userId = null;
  _initPromise = null;
  remoteIdentityCache.clear();
  sessionBootstrapRecipients.clear();
}

export function isSignalInitialized() { return _initialized; }
export function getSignalUserId() { return _userId; }

async function ensureVerifiedSession(recipientId) {
  await requireTrustedNpub(recipientId, { quarantineSession: true });

  if (!sessionBootstrapRecipients.has(recipientId)) {
    await bootstrapSessionFromVerifiedBundle(recipientId, { force: true });
    sessionBootstrapRecipients.add(recipientId);
    return;
  }

  let hasSession = await window.signalCrypto.hasSession(recipientId);
  if (hasSession) {
    await fetchVerifiedIdentity(recipientId);
    hasSession = await window.signalCrypto.hasSession(recipientId);
  }
  if (!hasSession) {
    await bootstrapSessionFromVerifiedBundle(recipientId);
  }
}

export async function signalEncrypt(recipientId, plaintext) {
  await ensureVerifiedSession(recipientId);
  try {
    return await window.signalCrypto.encrypt(recipientId, plaintext);
  } catch (err) {
    console.warn('[Signal] Encrypt failed, refreshing session:', err);
    await bootstrapSessionFromVerifiedBundle(recipientId, { force: true });
    sessionBootstrapRecipients.add(recipientId);
    return window.signalCrypto.encrypt(recipientId, plaintext);
  }
}

export async function signalDecrypt(senderId, type, payload) {
  await requireTrustedNpub(senderId, { quarantineSession: true });
  if (type === PREKEY_MESSAGE_TYPE && senderId !== _userId) {
    await fetchVerifiedIdentity(senderId);
  }
  return window.signalCrypto.decrypt(senderId, type, payload);
}

export async function hasSession(recipientId) {
  return window.signalCrypto.hasSession(recipientId);
}

export async function deleteSession(recipientId) {
  return window.signalCrypto.deleteSession(recipientId);
}

export async function getIdentityStatus(recipientId, identityKey = null) {
  return window.signalCrypto.getIdentityState(recipientId, identityKey);
}

export async function loadRemoteIdentityVerification(recipientId) {
  const identity = await fetchIdentityAttestationCached(recipientId);
  const { stableBundle, expectedNpub } = await validateIdentityAttestation(recipientId, identity);
  const trustState = await reconcileAttestedIdentity(recipientId, stableBundle.identityKey);

  return {
    identity,
    identityKey: stableBundle.identityKey,
    stableBundle,
    expectedNpub,
    trustState,
  };
}

export async function approveIdentity(recipientId, identityKey, options) {
  return window.signalCrypto.approveIdentity(recipientId, identityKey, options);
}

export async function markIdentityVerified(recipientId, identityKey) {
  return window.signalCrypto.markIdentityVerified(recipientId, identityKey);
}

export async function createSKDM(roomId) {
  return window.signalCrypto.createSKDM(roomId);
}

export async function processSKDM(senderId, skdm) {
  return window.signalCrypto.processSKDM(senderId, skdm);
}

export async function groupEncrypt(roomId, plaintext) {
  return window.signalCrypto.groupEncrypt(roomId, plaintext);
}

export async function groupDecrypt(senderId, roomId, payload) {
  return window.signalCrypto.groupDecrypt(senderId, roomId, payload);
}

export async function rekeyRoom(roomId) {
  return window.signalCrypto.rekeyRoom(roomId);
}

export async function getFingerprint(theirUserId, theirIdentityKey) {
  return window.signalCrypto.getFingerprint(theirUserId, theirIdentityKey);
}

function scheduleKeyMaintenance() {
  if (_maintenanceInterval) clearInterval(_maintenanceInterval);
  _maintenanceInterval = setInterval(async () => {
    if (!_initialized) return;
    try {
      await checkAndReplenishOTPs();
      await checkAndReplenishKyber();
    } catch (err) {
      console.error('[Signal] Key maintenance error:', err);
    }
  }, 5 * 60 * 1000);
}

async function checkAndReplenishOTPs() {
  try {
    const count = await window.signalCrypto.otpCount();
    if (count < OTP_REPLENISH_THRESHOLD) {
      const newKeys = await window.signalCrypto.replenishOTPs(100);
      await apiReplenishOTPs(newKeys);
    }
  } catch (err) {
    console.error('[Signal] OTP replenishment failed:', err);
  }
}

async function checkAndReplenishKyber() {
  try {
    const count = await window.signalCrypto.kyberCount();
    if (count < KYBER_REPLENISH_THRESHOLD) {
      const newKeys = await window.signalCrypto.replenishKyber(20);
      await apiReplenishKyber(newKeys);
    }
  } catch (err) {
    console.error('[Signal] Kyber replenishment failed:', err);
  }
}



