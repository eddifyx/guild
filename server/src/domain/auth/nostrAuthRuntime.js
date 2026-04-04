function createNostrAuthRuntime({
  cryptoModule,
  secp256k1,
  schnorr,
  bytesToHex,
  issueLoginChallenge,
  consumeValidatedLoginChallenge,
  challengeTtlMs = 300_000,
  maxChallenges = 10_000,
  cleanupIntervalMs = 60_000,
} = {}) {
  const challenges = new Map();
  const authEncryptionSecret = cryptoModule.randomBytes(32);
  const authPubkey = bytesToHex(schnorr.getPublicKey(authEncryptionSecret));

  function decryptNip04(ciphertextWithIv, senderPubkey) {
    if (typeof ciphertextWithIv !== 'string' || typeof senderPubkey !== 'string' || !/^[0-9a-f]{64}$/i.test(senderPubkey)) {
      throw new Error('Invalid NIP-04 payload');
    }

    const separatorIndex = ciphertextWithIv.lastIndexOf('?iv=');
    if (separatorIndex <= 0) {
      throw new Error('Missing NIP-04 IV');
    }

    const ciphertextB64 = ciphertextWithIv.slice(0, separatorIndex);
    const ivB64 = ciphertextWithIv.slice(separatorIndex + 4);
    const iv = Buffer.from(ivB64, 'base64');
    if (iv.length !== 16) {
      throw new Error('Invalid NIP-04 IV length');
    }

    const sharedPoint = secp256k1.getSharedSecret(authEncryptionSecret, `02${senderPubkey}`);
    const sharedX = Buffer.from(sharedPoint.slice(1, 33));
    const decipher = cryptoModule.createDecipheriv('aes-256-cbc', sharedX, iv);
    let plaintext = decipher.update(ciphertextB64, 'base64', 'utf8');
    plaintext += decipher.final('utf8');
    return plaintext;
  }

  function issueChallenge(now = Date.now()) {
    return issueLoginChallenge({
      challenges,
      maxChallenges,
      ttlMs: challengeTtlMs,
      randomBytes: cryptoModule.randomBytes,
      now,
    });
  }

  function consumeValidatedChallenge({
    challenge,
    signedEvent = null,
    validateLoginChallenge,
    validateLoginProofTimestamp,
  } = {}) {
    return consumeValidatedLoginChallenge({
      challenges,
      challenge,
      signedEvent,
      validateLoginChallenge,
      validateLoginProofTimestamp,
    });
  }

  function cleanupExpiredChallenges(now = Date.now()) {
    for (const [key, value] of challenges) {
      if (now >= value.expiresAt) {
        challenges.delete(key);
      }
    }
  }

  return {
    authPubkey,
    challengeTtlMs,
    cleanupIntervalMs,
    consumeValidatedChallenge,
    decryptNip04,
    issueChallenge,
    cleanupExpiredChallenges,
    getChallengeCount: () => challenges.size,
  };
}

module.exports = {
  createNostrAuthRuntime,
};
