/**
 * /guild E2E Encryption — PreKey Bundle REST Endpoints
 *
 * POST /api/keys/bundle          — Upload prekey bundle (v1 or v2 format)
 * GET  /api/keys/bundle/:userId  — Fetch a user's bundle (atomically claims OTP + Kyber)
 * GET  /api/keys/count           — Check remaining OTP count for authenticated user
 * POST /api/keys/replenish       — Upload additional one-time prekeys
 * POST /api/keys/replenish-kyber — Upload additional Kyber prekeys
 * DELETE /api/keys/reset         — Reset all keys for authenticated user
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { ed25519 } = require('@noble/curves/ed25519');
const {
  upsertIdentityKey,
  getIdentityKey,
  upsertSignedPreKey,
  getLatestSignedPreKey,
  insertOneTimePreKey,
  getAndClaimOneTimePreKey,
  countAvailableOTPs,
  resetUserKeys,
  insertKyberPreKey,
  getAndClaimKyberPreKey,
  countAvailableKyberPreKeys,
  getUserById,
} = require('../db');
const { verifyBundleAttestationEvent } = require('../utils/bundleAttestation');

/**
 * Verify an Ed25519 proof-of-possession signature (v1 only).
 */
function verifyProof(signingKeyB64, proofB64, message) {
  try {
    const pubkey = Buffer.from(signingKeyB64, 'base64');
    const signature = Buffer.from(proofB64, 'base64');
    return ed25519.verify(signature, message, pubkey);
  } catch {
    return false;
  }
}

/**
 * Validate that a string is valid base64 encoding of exactly `expectedBytes` bytes.
 */
function isValidBase64Key(str, expectedBytes) {
  if (typeof str !== 'string' || str.length === 0) return false;
  try {
    const buf = Buffer.from(str, 'base64');
    return buf.length === expectedBytes;
  } catch {
    return false;
  }
}

/**
 * Validate base64 key with a min/max byte range (for v2 keys that vary in size).
 */
function isValidBase64KeyRange(str, minBytes, maxBytes) {
  if (typeof str !== 'string' || str.length === 0) return false;
  try {
    const buf = Buffer.from(str, 'base64');
    return buf.length >= minBytes && buf.length <= maxBytes;
  } catch {
    return false;
  }
}

function parseBundleSignatureEvent(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

router.use(authMiddleware);

/**
 * Upload the user's full prekey bundle.
 * Accepts both v1 (with signingKey + proof) and v2 (libsignal format) bundles.
 */
router.post('/bundle', (req, res) => {
  try {
    const userId = req.userId;
    const {
      identityKey, signingKey, registrationId, signedPreKey,
      oneTimePreKeys, kyberPreKey, kyberPreKeys,
      proof, rotationProof, proofTimestamp, bundleSignatureEvent,
    } = req.body;

    if (!identityKey || !registrationId || !signedPreKey) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (!Number.isInteger(registrationId) || registrationId < 0) {
      return res.status(400).json({ error: 'registrationId must be a non-negative integer' });
    }

    // Detect v2 bundle: no signingKey field means libsignal format
    const isV2 = !signingKey;

    if (isV2) {
      // V2 validation: libsignal keys are 33 bytes (0x05 prefix + 32 bytes)
      if (!isValidBase64KeyRange(identityKey, 32, 33)) {
        return res.status(400).json({ error: 'identityKey must be 32-33 bytes (base64)' });
      }
      if (!signedPreKey.keyId || !signedPreKey.publicKey || !signedPreKey.signature) {
        return res.status(400).json({ error: 'signedPreKey must include keyId, publicKey, signature' });
      }
      if (!isValidBase64KeyRange(signedPreKey.publicKey, 32, 33)) {
        return res.status(400).json({ error: 'signedPreKey.publicKey must be 32-33 bytes' });
      }
      if (!isValidBase64KeyRange(signedPreKey.signature, 64, 64)) {
        return res.status(400).json({ error: 'signedPreKey.signature must be 64 bytes' });
      }
      if (!bundleSignatureEvent || typeof bundleSignatureEvent !== 'object') {
        return res.status(400).json({ error: 'bundleSignatureEvent is required for v2 bundles' });
      }
      const user = getUserById.get(userId);
      if (!user?.npub) {
        return res.status(403).json({ error: 'User has no Nostr identity bound to this account' });
      }
      const attestedBundle = {
        identityKey,
        registrationId,
        signedPreKey: {
          keyId: signedPreKey.keyId,
          publicKey: signedPreKey.publicKey,
          signature: signedPreKey.signature,
        },
      };
      if (!verifyBundleAttestationEvent(bundleSignatureEvent, attestedBundle, user.npub)) {
        return res.status(403).json({ error: 'Invalid bundle attestation signature' });
      }
    } else {
      // V1 validation (legacy)
      if (!isValidBase64Key(identityKey, 32)) {
        return res.status(400).json({ error: 'identityKey must be 32 bytes (base64)' });
      }
      if (!isValidBase64Key(signingKey, 32)) {
        return res.status(400).json({ error: 'signingKey must be 32 bytes (base64)' });
      }

      // V1: require proof of possession
      if (!proof) {
        return res.status(400).json({ error: 'Missing proof of possession' });
      }
      if (!proofTimestamp || typeof proofTimestamp !== 'number') {
        return res.status(400).json({ error: 'Missing or invalid proofTimestamp' });
      }
      const now = Date.now();
      const PROOF_WINDOW_MS = 5 * 60 * 1000;
      if (Math.abs(now - proofTimestamp) > PROOF_WINDOW_MS) {
        return res.status(403).json({ error: 'Proof of possession expired' });
      }
      const proofMessage = new TextEncoder().encode(
        `bundle-proof:${userId}:${identityKey}:${signingKey}:${registrationId}:${proofTimestamp}`
      );
      if (!verifyProof(signingKey, proof, proofMessage)) {
        return res.status(403).json({ error: 'Invalid proof of possession' });
      }

      // V1: key rotation proof
      const existing = getIdentityKey.get(userId);
      if (existing && existing.signing_key_public !== signingKey) {
        if (!rotationProof) {
          return res.status(403).json({ error: 'Key rotation requires rotationProof' });
        }
        const rotateMessage = new TextEncoder().encode(`bundle-rotate:${userId}:${signingKey}:${proofTimestamp}`);
        if (!verifyProof(existing.signing_key_public, rotationProof, rotateMessage)) {
          return res.status(403).json({ error: 'Invalid rotation proof' });
        }
      }

      // V1: validate signed prekey
      if (!signedPreKey.keyId || !signedPreKey.publicKey || !signedPreKey.signature) {
        return res.status(400).json({ error: 'signedPreKey must include keyId, publicKey, signature' });
      }
      if (!isValidBase64Key(signedPreKey.publicKey, 32)) {
        return res.status(400).json({ error: 'signedPreKey.publicKey must be 32 bytes' });
      }
      if (!isValidBase64Key(signedPreKey.signature, 64)) {
        return res.status(400).json({ error: 'signedPreKey.signature must be 64 bytes' });
      }

      // V1: verify SPK signature
      const spkMessage = Buffer.from(`spk:${signedPreKey.keyId}:${signedPreKey.publicKey}`, 'utf8');
      if (!verifyProof(signingKey, signedPreKey.signature, spkMessage)) {
        return res.status(403).json({ error: 'Invalid signed prekey signature' });
      }
    }

    // Validate one-time prekeys (both v1 and v2)
    const MAX_OTP_UPLOAD = 200;
    if (oneTimePreKeys && oneTimePreKeys.length > MAX_OTP_UPLOAD) {
      return res.status(400).json({ error: `Too many OTPs (max ${MAX_OTP_UPLOAD})` });
    }

    const replaceServerPreKeys = Array.isArray(oneTimePreKeys)
      || !!kyberPreKey
      || (Array.isArray(kyberPreKeys) && kyberPreKeys.length > 0);

    // Write everything atomically
    const { db } = require('../db');
    const deleteUserOneTimePreKeys = db.prepare('DELETE FROM one_time_prekeys WHERE user_id = ?');
    const deleteUserKyberPreKeys = db.prepare('DELETE FROM kyber_prekeys WHERE user_id = ?');
    const deleteUserSignedPreKeys = db.prepare('DELETE FROM signed_prekeys WHERE user_id = ?');
    db.transaction(() => {
      if (replaceServerPreKeys) {
        deleteUserOneTimePreKeys.run(userId);
        deleteUserKyberPreKeys.run(userId);
        deleteUserSignedPreKeys.run(userId);
      }
      // For v2, use identityKey as both identity and signing key (XEdDSA)
      const storedSigningKey = signingKey || identityKey;
      upsertIdentityKey.run(
        userId,
        identityKey,
        storedSigningKey,
        registrationId,
        isV2 ? JSON.stringify(bundleSignatureEvent) : null
      );
      upsertSignedPreKey.run(userId, signedPreKey.keyId, signedPreKey.publicKey, signedPreKey.signature);

      // One-time prekeys
      if (oneTimePreKeys && oneTimePreKeys.length > 0) {
        const minKeySize = isV2 ? 32 : 32;
        const maxKeySize = isV2 ? 33 : 32;
        for (const otk of oneTimePreKeys) {
          if (!otk.keyId || !otk.publicKey) continue;
          if (!isValidBase64KeyRange(otk.publicKey, minKeySize, maxKeySize)) continue;
          insertOneTimePreKey.run(userId, otk.keyId, otk.publicKey);
        }
      }

      // Kyber prekeys (v2 only)
      if (kyberPreKey) {
        insertKyberPreKey.run(userId, kyberPreKey.keyId, kyberPreKey.publicKey, kyberPreKey.signature);
      }
      if (kyberPreKeys && Array.isArray(kyberPreKeys)) {
        for (const kpk of kyberPreKeys) {
          if (!kpk.keyId || !kpk.publicKey || !kpk.signature) continue;
          insertKyberPreKey.run(userId, kpk.keyId, kpk.publicKey, kpk.signature);
        }
      }
    })();

    res.json({ success: true });
  } catch (err) {
    console.error('Error uploading prekey bundle:', err);
    res.status(500).json({ error: 'Failed to upload prekey bundle' });
  }
});

// Rate limiter for bundle fetches
const bundleRateLimit = new Map();
const BUNDLE_RATE_WINDOW = 60000;
const BUNDLE_RATE_MAX = 10;

const targetRateLimit = new Map();
const TARGET_RATE_WINDOW = 60000;
const TARGET_RATE_MAX = 20;

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of bundleRateLimit) {
    if (now >= val.resetTime) bundleRateLimit.delete(key);
  }
  for (const [key, val] of targetRateLimit) {
    if (now >= val.resetTime) targetRateLimit.delete(key);
  }
}, 120_000);

/**
 * Fetch a user's prekey bundle for initiating an encrypted session.
 * Atomically claims one OTP and one Kyber prekey.
 */
router.get('/bundle/:userId', (req, res) => {
  try {
    const targetUserId = req.params.userId;

    if (targetUserId === req.userId) {
      return res.status(400).json({ error: 'Cannot fetch own prekey bundle' });
    }

    // Rate limiting
    const now = Date.now();

    const trl = targetRateLimit.get(targetUserId);
    if (trl && now < trl.resetTime) {
      if (trl.count >= TARGET_RATE_MAX) {
        return res.status(429).json({ error: 'Too many bundle requests for this user. Try again later.' });
      }
      trl.count++;
    } else {
      targetRateLimit.set(targetUserId, { count: 1, resetTime: now + TARGET_RATE_WINDOW });
    }

    const rlKey = `${req.userId}:${targetUserId}`;
    const rl = bundleRateLimit.get(rlKey);
    if (rl && now < rl.resetTime) {
      if (rl.count >= BUNDLE_RATE_MAX) {
        return res.status(429).json({ error: 'Too many bundle requests. Try again later.' });
      }
      rl.count++;
    } else {
      bundleRateLimit.set(rlKey, { count: 1, resetTime: now + BUNDLE_RATE_WINDOW });
    }

    const identity = getIdentityKey.get(targetUserId);
    if (!identity) {
      return res.status(404).json({ error: 'User has no encryption keys' });
    }

    const signedPreKey = getLatestSignedPreKey.get(targetUserId);
    if (!signedPreKey) {
      return res.status(404).json({ error: 'User has no signed prekey' });
    }

    // Atomically claim one OTP (may return null if exhausted)
    const oneTimePreKey = getAndClaimOneTimePreKey(targetUserId);

    // Atomically claim one Kyber prekey (may return null if not available)
    const kyberPreKey = getAndClaimKyberPreKey(targetUserId);

    const response = {
      identityKey: identity.identity_key_public,
      signingKey: identity.signing_key_public,
      registrationId: identity.registration_id,
      bundleSignatureEvent: parseBundleSignatureEvent(identity.bundle_signature_event),
      signedPreKey: {
        keyId: signedPreKey.key_id,
        publicKey: signedPreKey.public_key,
        signature: signedPreKey.signature,
      },
      oneTimePreKey: oneTimePreKey ? {
        keyId: oneTimePreKey.key_id,
        publicKey: oneTimePreKey.public_key,
      } : null,
      kyberPreKey: kyberPreKey ? {
        keyId: kyberPreKey.key_id,
        publicKey: kyberPreKey.public_key,
        signature: kyberPreKey.signature,
      } : null,
    };

    res.json(response);
  } catch (err) {
    console.error('Error fetching prekey bundle:', err);
    res.status(500).json({ error: 'Failed to fetch prekey bundle' });
  }
});

/**
 * Fetch a user's stable identity record without consuming one-time or Kyber prekeys.
 */
router.get('/identity/:userId', (req, res) => {
  try {
    const targetUserId = req.params.userId;

    if (targetUserId === req.userId) {
      return res.status(400).json({ error: 'Cannot fetch own identity record' });
    }

    const identity = getIdentityKey.get(targetUserId);
    if (!identity) {
      return res.status(404).json({ error: 'User has no encryption keys' });
    }

    const signedPreKey = getLatestSignedPreKey.get(targetUserId);
    if (!signedPreKey) {
      return res.status(404).json({ error: 'User has no signed prekey' });
    }

    res.json({
      identityKey: identity.identity_key_public,
      signingKey: identity.signing_key_public,
      registrationId: identity.registration_id,
      bundleSignatureEvent: parseBundleSignatureEvent(identity.bundle_signature_event),
      signedPreKey: {
        keyId: signedPreKey.key_id,
        publicKey: signedPreKey.public_key,
        signature: signedPreKey.signature,
      },
    });
  } catch (err) {
    console.error('Error fetching identity record:', err);
    res.status(500).json({ error: 'Failed to fetch identity record' });
  }
});

/**
 * Check remaining one-time prekey count for the authenticated user.
 */
router.get('/count', (req, res) => {
  try {
    const result = countAvailableOTPs.get(req.userId);
    res.json({ count: result ? result.count : 0 });
  } catch (err) {
    console.error('Error counting OTPs:', err);
    res.status(500).json({ error: 'Failed to count OTPs' });
  }
});

/**
 * Upload additional one-time prekeys to replenish the pool.
 */
router.post('/replenish', (req, res) => {
  try {
    const { oneTimePreKeys } = req.body;
    if (!oneTimePreKeys || !Array.isArray(oneTimePreKeys)) {
      return res.status(400).json({ error: 'oneTimePreKeys array required' });
    }

    const MAX_OTP_REPLENISH = 200;
    const MAX_OTP_TOTAL = 500;
    if (oneTimePreKeys.length > MAX_OTP_REPLENISH) {
      return res.status(400).json({ error: `Too many OTPs (max ${MAX_OTP_REPLENISH})` });
    }

    const currentCount = countAvailableOTPs.get(req.userId);
    const current = currentCount ? currentCount.count : 0;
    if (current + oneTimePreKeys.length > MAX_OTP_TOTAL) {
      return res.status(400).json({ error: `OTP limit exceeded (${current} existing + ${oneTimePreKeys.length} new > ${MAX_OTP_TOTAL} max)` });
    }

    for (const otk of oneTimePreKeys) {
      if (!otk.keyId || !otk.publicKey) continue;
      // Accept 32-byte (v1) or 33-byte (v2) keys
      if (!isValidBase64KeyRange(otk.publicKey, 32, 33)) continue;
      insertOneTimePreKey.run(req.userId, otk.keyId, otk.publicKey);
    }

    const result = countAvailableOTPs.get(req.userId);
    res.json({ success: true, count: result ? result.count : 0 });
  } catch (err) {
    console.error('Error replenishing OTPs:', err);
    res.status(500).json({ error: 'Failed to replenish OTPs' });
  }
});

/**
 * Upload additional Kyber prekeys to replenish the pool.
 */
router.post('/replenish-kyber', (req, res) => {
  try {
    const { kyberPreKeys } = req.body;
    if (!kyberPreKeys || !Array.isArray(kyberPreKeys)) {
      return res.status(400).json({ error: 'kyberPreKeys array required' });
    }

    const MAX_KYBER_REPLENISH = 50;
    const MAX_KYBER_TOTAL = 100;
    if (kyberPreKeys.length > MAX_KYBER_REPLENISH) {
      return res.status(400).json({ error: `Too many Kyber prekeys (max ${MAX_KYBER_REPLENISH})` });
    }

    const currentCount = countAvailableKyberPreKeys.get(req.userId);
    const current = currentCount ? currentCount.count : 0;
    if (current + kyberPreKeys.length > MAX_KYBER_TOTAL) {
      return res.status(400).json({ error: `Kyber prekey limit exceeded (${current} + ${kyberPreKeys.length} > ${MAX_KYBER_TOTAL})` });
    }

    for (const kpk of kyberPreKeys) {
      if (!kpk.keyId || !kpk.publicKey || !kpk.signature) continue;
      insertKyberPreKey.run(req.userId, kpk.keyId, kpk.publicKey, kpk.signature);
    }

    const result = countAvailableKyberPreKeys.get(req.userId);
    res.json({ success: true, count: result ? result.count : 0 });
  } catch (err) {
    console.error('Error replenishing Kyber prekeys:', err);
    res.status(500).json({ error: 'Failed to replenish Kyber prekeys' });
  }
});

/**
 * Reset all encryption keys for the authenticated user.
 */
router.delete('/reset', (req, res) => {
  try {
    resetUserKeys(req.userId);
    res.json({ success: true });
  } catch (err) {
    console.error('Error resetting user keys:', err);
    res.status(500).json({ error: 'Failed to reset keys' });
  }
});

module.exports = router;

