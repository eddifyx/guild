/**
 * /guild E2E Encryption — X3DH (Extended Triple Diffie-Hellman)
 *
 * Implements the Signal X3DH key agreement protocol for establishing
 * shared secrets between two users who may be offline.
 *
 * Reference: https://signal.org/docs/specifications/x3dh/
 *
 * Protocol flow:
 *   Alice (initiator) fetches Bob's prekey bundle from the server, then:
 *     DH1 = X25519(IK_A, SPK_B)    — Alice identity,  Bob signed prekey
 *     DH2 = X25519(EK_A, IK_B)     — Alice ephemeral, Bob identity
 *     DH3 = X25519(EK_A, SPK_B)    — Alice ephemeral, Bob signed prekey
 *     DH4 = X25519(EK_A, OPK_B)    — Alice ephemeral, Bob one-time prekey (if available)
 *     SK  = HKDF(DH1||DH2||DH3[||DH4], 0x00*32, "ByzantineX3DH", 32)
 *
 *   Bob (responder) processes Alice's first message, mirrors the DH operations,
 *   and derives the same SK.
 */

import {
  generateX25519KeyPair,
  x25519DH,
  ed25519Verify,
  hkdfSha256,
  concatBytes,
  constantTimeEqual,
  rejectSmallOrderPoint,
  assertNonZeroDH,
  fromBase64,
  toBase64,
} from './primitives.js';
import { edwardsToMontgomeryPub } from '@noble/curves/ed25519';

const X3DH_INFO = 'ByzantineX3DH';
const ZERO_SALT = new Uint8Array(32); // 32 zero bytes

/**
 * Alice initiates an X3DH key exchange with Bob.
 *
 * @param {KeyStore} keyStore — Alice's key store (to load her identity key)
 * @param {object} bobBundle — Bob's prekey bundle from the server:
 *   { identityKey, signingKey, signedPreKey: { keyId, publicKey, signature }, oneTimePreKey? }
 * @returns {Promise<{ sharedSecret, x3dhHeader, bobIdentityKey }>}
 */
export async function performX3DH(keyStore, bobBundle) {
  // Load Alice's identity
  const aliceIdentityData = await keyStore.getIdentityKeyPair();
  if (!aliceIdentityData) throw new Error('No identity key pair found');

  const IK_A_private = fromBase64(aliceIdentityData.identityKeyPrivate);
  const IK_A_public = fromBase64(aliceIdentityData.identityKeyPublic);

  // Parse Bob's bundle
  const IK_B = fromBase64(bobBundle.identityKey);
  const signingKey_B = fromBase64(bobBundle.signingKey);
  const SPK_B = fromBase64(bobBundle.signedPreKey.publicKey);
  const SPK_B_signature = fromBase64(bobBundle.signedPreKey.signature);

  // Validate key lengths
  if (IK_B.length !== 32) throw new Error('X3DH: Invalid identity key length');
  if (signingKey_B.length !== 32) throw new Error('X3DH: Invalid signing key length');
  if (SPK_B.length !== 32) throw new Error('X3DH: Invalid signed prekey length');
  if (SPK_B_signature.length !== 64) throw new Error('X3DH: Invalid signature length');

  // Reject small-order public keys that produce predictable DH outputs
  rejectSmallOrderPoint(IK_B, 'Bob identity key');
  rejectSmallOrderPoint(SPK_B, 'Bob signed prekey');

  // 1a. Verify that Bob's signing key (Ed25519) is cryptographically bound
  // to his identity key (X25519) via the birational map. Without this check,
  // a malicious server could supply a valid signing key with a mismatched
  // identity key, enabling an identity misbinding attack.
  const derivedDH = edwardsToMontgomeryPub(signingKey_B);
  if (!constantTimeEqual(derivedDH, IK_B)) {
    throw new Error('X3DH: Identity key does not match signing key (birational map mismatch)');
  }

  // 1b. Verify Bob's signed prekey signature against canonical message
  //     Must match the format used in prekeys.js:generateSignedPreKey()
  const spkMessage = new TextEncoder().encode(
    `spk:${bobBundle.signedPreKey.keyId}:${bobBundle.signedPreKey.publicKey}`
  );
  if (!ed25519Verify(signingKey_B, spkMessage, SPK_B_signature)) {
    throw new Error('X3DH: Invalid signed prekey signature');
  }

  // 2. Generate ephemeral key pair
  const ephemeral = generateX25519KeyPair();

  // 3. Compute DH values and validate outputs
  const DH1 = x25519DH(IK_A_private, SPK_B);
  assertNonZeroDH(DH1, 'DH1(IK_A, SPK_B)');
  const DH2 = x25519DH(ephemeral.privateKey, IK_B);
  assertNonZeroDH(DH2, 'DH2(EK_A, IK_B)');
  const DH3 = x25519DH(ephemeral.privateKey, SPK_B);
  assertNonZeroDH(DH3, 'DH3(EK_A, SPK_B)');

  let dhConcat = concatBytes(DH1, DH2, DH3);
  let DH4 = null;

  let usedOneTimePreKeyId = null;
  if (bobBundle.oneTimePreKey) {
    const OPK_B = fromBase64(bobBundle.oneTimePreKey.publicKey);
    if (OPK_B.length !== 32) throw new Error('X3DH: Invalid one-time prekey length');
    rejectSmallOrderPoint(OPK_B, 'Bob one-time prekey');
    DH4 = x25519DH(ephemeral.privateKey, OPK_B);
    assertNonZeroDH(DH4, 'DH4(EK_A, OPK_B)');
    dhConcat = concatBytes(dhConcat, DH4);
    usedOneTimePreKeyId = bobBundle.oneTimePreKey.keyId;
  }

  // 4. Derive shared secret
  const sharedSecret = hkdfSha256(dhConcat, ZERO_SALT, X3DH_INFO, 32);

  // 5. Securely erase all intermediate key material
  ephemeral.privateKey.fill(0);
  DH1.fill(0);
  DH2.fill(0);
  DH3.fill(0);
  if (DH4) DH4.fill(0);
  dhConcat.fill(0);
  IK_A_private.fill(0);

  // 6. Build the X3DH header to include in Alice's first message
  const x3dhHeader = {
    senderIdentityKey: toBase64(IK_A_public),
    ephemeralPublicKey: toBase64(ephemeral.publicKey),
    usedSignedPreKeyId: bobBundle.signedPreKey.keyId,
    usedOneTimePreKeyId,
  };

  return {
    sharedSecret,
    x3dhHeader,
    bobIdentityKey: bobBundle.identityKey, // base64, for TOFU
    bobSignedPreKeyPublic: SPK_B,          // raw, for Double Ratchet init
  };
}

/**
 * Bob processes an incoming X3DH initial message from Alice.
 *
 * @param {KeyStore} keyStore — Bob's key store
 * @param {object} x3dhHeader — from Alice's first message:
 *   { senderIdentityKey, ephemeralPublicKey, usedSignedPreKeyId, usedOneTimePreKeyId }
 * @returns {Promise<{ sharedSecret, senderIdentityKey, signedPreKeyPair }>}
 */
export async function processX3DHInitMessage(keyStore, x3dhHeader) {
  // Load Bob's identity
  const bobIdentityData = await keyStore.getIdentityKeyPair();
  if (!bobIdentityData) throw new Error('No identity key pair found');

  const IK_B_private = fromBase64(bobIdentityData.identityKeyPrivate);

  // Parse Alice's data
  const IK_A = fromBase64(x3dhHeader.senderIdentityKey);
  const EK_A = fromBase64(x3dhHeader.ephemeralPublicKey);

  // Validate key lengths
  if (IK_A.length !== 32) throw new Error('X3DH: Invalid sender identity key length');
  if (EK_A.length !== 32) throw new Error('X3DH: Invalid sender ephemeral key length');

  // Reject small-order public keys
  rejectSmallOrderPoint(IK_A, 'Alice identity key');
  rejectSmallOrderPoint(EK_A, 'Alice ephemeral key');

  // Load the signed prekey Alice referenced
  const signedPreKey = await keyStore.getSignedPreKey(x3dhHeader.usedSignedPreKeyId);
  if (!signedPreKey) {
    throw new Error(`X3DH: Signed prekey ${x3dhHeader.usedSignedPreKeyId} not found`);
  }
  const SPK_B_private = fromBase64(signedPreKey.privateKey);
  const SPK_B_public = fromBase64(signedPreKey.publicKey);

  // Compute DH values (mirrored from Alice's perspective) and validate outputs
  const DH1 = x25519DH(SPK_B_private, IK_A);
  assertNonZeroDH(DH1, 'DH1(SPK_B, IK_A)');
  const DH2 = x25519DH(IK_B_private, EK_A);
  assertNonZeroDH(DH2, 'DH2(IK_B, EK_A)');
  const DH3 = x25519DH(SPK_B_private, EK_A);
  assertNonZeroDH(DH3, 'DH3(SPK_B, EK_A)');

  let dhConcat = concatBytes(DH1, DH2, DH3);
  let DH4 = null;

  // Process one-time prekey if used
  if (x3dhHeader.usedOneTimePreKeyId != null) {
    const otp = await keyStore.getOneTimePreKey(x3dhHeader.usedOneTimePreKeyId);
    if (!otp) {
      throw new Error(`X3DH: One-time prekey ${x3dhHeader.usedOneTimePreKeyId} not found. Cannot establish session — Alice included DH4 but Bob lacks the matching key.`);
    }
    const OPK_B_private = fromBase64(otp.privateKey);
    DH4 = x25519DH(OPK_B_private, EK_A);
    assertNonZeroDH(DH4, 'DH4(OPK_B, EK_A)');
    dhConcat = concatBytes(dhConcat, DH4);
    OPK_B_private.fill(0);
    // Consume the one-time prekey (single use)
    await keyStore.markOneTimePreKeyUsed(x3dhHeader.usedOneTimePreKeyId);
  }

  // Derive the same shared secret as Alice
  const sharedSecret = hkdfSha256(dhConcat, ZERO_SALT, X3DH_INFO, 32);

  // Securely erase all intermediate key material
  DH1.fill(0);
  DH2.fill(0);
  DH3.fill(0);
  if (DH4) DH4.fill(0);
  dhConcat.fill(0);
  IK_B_private.fill(0);

  return {
    sharedSecret,
    senderIdentityKey: x3dhHeader.senderIdentityKey, // base64, for TOFU
    signedPreKeyPair: {
      privateKey: SPK_B_private,
      publicKey: SPK_B_public,
    },
  };
}
