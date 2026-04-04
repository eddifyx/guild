const { ed25519 } = require('@noble/curves/ed25519');

const PROOF_WINDOW_MS = 5 * 60 * 1000;
const MAX_OTP_UPLOAD = 200;

function verifyProof(signingKeyB64, proofB64, message) {
  try {
    const pubkey = Buffer.from(signingKeyB64, 'base64');
    const signature = Buffer.from(proofB64, 'base64');
    return ed25519.verify(signature, message, pubkey);
  } catch {
    return false;
  }
}

function isValidBase64Key(str, expectedBytes) {
  if (typeof str !== 'string' || str.length === 0) return false;
  try {
    const buf = Buffer.from(str, 'base64');
    return buf.length === expectedBytes;
  } catch {
    return false;
  }
}

function isValidBase64KeyRange(str, minBytes, maxBytes) {
  if (typeof str !== 'string' || str.length === 0) return false;
  try {
    const buf = Buffer.from(str, 'base64');
    return buf.length >= minBytes && buf.length <= maxBytes;
  } catch {
    return false;
  }
}

async function validateBundleUploadRequest({
  userId,
  body = {},
  existingLegacyIdentity = null,
  userNpub = null,
  nowMs = Date.now(),
  verifyProofFn = verifyProof,
  verifyBundleAttestationEventFn = () => true,
  textEncoderCtor = TextEncoder,
} = {}) {
  const {
    identityKey,
    signingKey,
    registrationId,
    signedPreKey,
    oneTimePreKeys,
    kyberPreKey,
    kyberPreKeys,
    proof,
    rotationProof,
    proofTimestamp,
    bundleSignatureEvent,
  } = body;

  if (!identityKey || !registrationId || !signedPreKey) {
    return { ok: false, status: 400, error: 'Missing required fields' };
  }
  if (!Number.isInteger(registrationId) || registrationId < 0) {
    return { ok: false, status: 400, error: 'registrationId must be a non-negative integer' };
  }

  const isV2 = !signingKey;

  if (isV2) {
    if (!isValidBase64KeyRange(identityKey, 32, 33)) {
      return { ok: false, status: 400, error: 'identityKey must be 32-33 bytes (base64)' };
    }
    if (!signedPreKey.keyId || !signedPreKey.publicKey || !signedPreKey.signature) {
      return { ok: false, status: 400, error: 'signedPreKey must include keyId, publicKey, signature' };
    }
    if (!isValidBase64KeyRange(signedPreKey.publicKey, 32, 33)) {
      return { ok: false, status: 400, error: 'signedPreKey.publicKey must be 32-33 bytes' };
    }
    if (!isValidBase64KeyRange(signedPreKey.signature, 64, 64)) {
      return { ok: false, status: 400, error: 'signedPreKey.signature must be 64 bytes' };
    }
    if (!bundleSignatureEvent || typeof bundleSignatureEvent !== 'object') {
      return { ok: false, status: 400, error: 'bundleSignatureEvent is required for v2 bundles' };
    }
    if (!userNpub) {
      return { ok: false, status: 403, error: 'User has no Nostr identity bound to this account' };
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
    if (!await verifyBundleAttestationEventFn(bundleSignatureEvent, attestedBundle, userNpub)) {
      return { ok: false, status: 403, error: 'Invalid bundle attestation signature' };
    }
  } else {
    if (!isValidBase64Key(identityKey, 32)) {
      return { ok: false, status: 400, error: 'identityKey must be 32 bytes (base64)' };
    }
    if (!isValidBase64Key(signingKey, 32)) {
      return { ok: false, status: 400, error: 'signingKey must be 32 bytes (base64)' };
    }
    if (!proof) {
      return { ok: false, status: 400, error: 'Missing proof of possession' };
    }
    if (!proofTimestamp || typeof proofTimestamp !== 'number') {
      return { ok: false, status: 400, error: 'Missing or invalid proofTimestamp' };
    }
    if (Math.abs(nowMs - proofTimestamp) > PROOF_WINDOW_MS) {
      return { ok: false, status: 403, error: 'Proof of possession expired' };
    }
    const textEncoder = new textEncoderCtor();
    const proofMessage = textEncoder.encode(
      `bundle-proof:${userId}:${identityKey}:${signingKey}:${registrationId}:${proofTimestamp}`,
    );
    if (!verifyProofFn(signingKey, proof, proofMessage)) {
      return { ok: false, status: 403, error: 'Invalid proof of possession' };
    }

    if (existingLegacyIdentity && existingLegacyIdentity.signing_key_public !== signingKey) {
      if (!rotationProof) {
        return { ok: false, status: 403, error: 'Key rotation requires rotationProof' };
      }
      const rotateMessage = textEncoder.encode(`bundle-rotate:${userId}:${signingKey}:${proofTimestamp}`);
      if (!verifyProofFn(existingLegacyIdentity.signing_key_public, rotationProof, rotateMessage)) {
        return { ok: false, status: 403, error: 'Invalid rotation proof' };
      }
    }

    if (!signedPreKey.keyId || !signedPreKey.publicKey || !signedPreKey.signature) {
      return { ok: false, status: 400, error: 'signedPreKey must include keyId, publicKey, signature' };
    }
    if (!isValidBase64Key(signedPreKey.publicKey, 32)) {
      return { ok: false, status: 400, error: 'signedPreKey.publicKey must be 32 bytes' };
    }
    if (!isValidBase64Key(signedPreKey.signature, 64)) {
      return { ok: false, status: 400, error: 'signedPreKey.signature must be 64 bytes' };
    }

    const spkMessage = Buffer.from(`spk:${signedPreKey.keyId}:${signedPreKey.publicKey}`, 'utf8');
    if (!verifyProofFn(signingKey, signedPreKey.signature, spkMessage)) {
      return { ok: false, status: 403, error: 'Invalid signed prekey signature' };
    }
  }

  if (oneTimePreKeys && oneTimePreKeys.length > MAX_OTP_UPLOAD) {
    return { ok: false, status: 400, error: `Too many OTPs (max ${MAX_OTP_UPLOAD})` };
  }

  return {
    ok: true,
    value: {
      isV2,
      storedSigningKey: signingKey || identityKey,
      replaceServerPreKeys: Array.isArray(oneTimePreKeys)
        || !!kyberPreKey
        || (Array.isArray(kyberPreKeys) && kyberPreKeys.length > 0),
    },
  };
}

module.exports = {
  isValidBase64Key,
  isValidBase64KeyRange,
  validateBundleUploadRequest,
  verifyProof,
};
