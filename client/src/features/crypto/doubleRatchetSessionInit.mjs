import { generateX25519KeyPair, x25519DH, toBase64 } from '../../crypto/primitives.js';
import { deriveRatchetRootAndChainKey } from './doubleRatchetSupport.mjs';

export function initializeRatchetSessionAsAlice(sharedSecret, bobSignedPreKeyPublic) {
  const DHs = generateX25519KeyPair();
  const dhOutput = x25519DH(DHs.privateKey, bobSignedPreKeyPublic);
  const [RK, CKs] = deriveRatchetRootAndChainKey(sharedSecret, dhOutput);

  dhOutput.fill(0);

  const result = {
    DHs: { privateKey: toBase64(DHs.privateKey), publicKey: toBase64(DHs.publicKey) },
    DHr: toBase64(bobSignedPreKeyPublic),
    RK: toBase64(RK),
    CKs: toBase64(CKs),
    CKr: null,
    Ns: 0,
    Nr: 0,
    PN: 0,
    MKSKIPPED: {},
  };

  DHs.privateKey.fill(0);
  RK.fill(0);
  CKs.fill(0);

  return result;
}

export function initializeRatchetSessionAsBob(sharedSecret, signedPreKeyPair) {
  return {
    DHs: {
      privateKey: toBase64(signedPreKeyPair.privateKey),
      publicKey: toBase64(signedPreKeyPair.publicKey),
    },
    DHr: null,
    RK: toBase64(sharedSecret),
    CKs: null,
    CKr: null,
    Ns: 0,
    Nr: 0,
    PN: 0,
    MKSKIPPED: {},
  };
}
