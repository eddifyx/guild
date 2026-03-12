/**
 * /guild E2E Encryption — Identity Key Management
 *
 * Each user has a long-term identity derived from a 32-byte seed:
 *   - X25519 key pair for Diffie-Hellman (used in X3DH and Double Ratchet)
 *   - Ed25519 key pair for signing (used for signed prekeys, sender keys)
 *
 * Both pairs are deterministically derived from the same seed via
 * the standard Ed25519 → X25519 birational map.
 */

import {
  generateIdentityKeyPairFromSeed,
  randomBytes,
  toBase64,
  fromBase64,
} from './primitives.js';

/**
 * Generate a brand-new identity key pair from a random seed.
 * @returns {{ identityKey: {privateKey, publicKey}, signingKey: {privateKey, publicKey}, registrationId: number, seed: Uint8Array }}
 */
export function generateIdentityKeyPair() {
  const seed = randomBytes(32);
  const { identityKey, signingKey } = generateIdentityKeyPairFromSeed(seed);
  // Registration ID: random 14-bit integer (0–16383) for protocol versioning
  const regIdBytes = randomBytes(2);
  const registrationId = ((regIdBytes[0] << 8) | regIdBytes[1]) & 0x3FFF;

  return { identityKey, signingKey, registrationId, seed };
}

/**
 * Reconstruct identity key pair from an existing seed.
 */
export function identityKeyPairFromSeed(seed, registrationId) {
  const { identityKey, signingKey } = generateIdentityKeyPairFromSeed(seed);
  return { identityKey, signingKey, registrationId };
}

/**
 * Get or create the user's identity key pair.
 * On first run, generates a new identity and persists it.
 * On subsequent runs, loads the existing identity.
 *
 * @param {KeyStore} keyStore — initialized key store
 * @returns {Promise<{ identityKey, signingKey, registrationId }>}
 */
export async function getOrCreateIdentityKeyPair(keyStore) {
  const existing = await keyStore.getIdentityKeyPair();
  if (existing) {
    return {
      identityKey: {
        privateKey: fromBase64(existing.identityKeyPrivate),
        publicKey: fromBase64(existing.identityKeyPublic),
      },
      signingKey: {
        privateKey: fromBase64(existing.signingKeyPrivate),
        publicKey: fromBase64(existing.signingKeyPublic),
      },
      registrationId: existing.registrationId,
    };
  }

  // Generate new identity
  const { identityKey, signingKey, registrationId, seed } = generateIdentityKeyPair();

  // Zero the seed immediately — individual private keys are stored separately
  seed.fill(0);

  // Persist to key store (base64-encoded for JSON serialization)
  await keyStore.saveIdentityKeyPair({
    identityKeyPrivate: toBase64(identityKey.privateKey),
    identityKeyPublic: toBase64(identityKey.publicKey),
    signingKeyPrivate: toBase64(signingKey.privateKey),
    signingKeyPublic: toBase64(signingKey.publicKey),
    registrationId,
  });

  return { identityKey, signingKey, registrationId };
}
