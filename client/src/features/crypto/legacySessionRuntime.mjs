export function createLegacySessionRuntime({
  sessionLocks = new Map(),
  isV1StoreReadyFn = () => false,
  getKeyStoreFn = () => null,
  processX3DHInitMessageFn = async () => ({}),
  initializeSessionAsBobFn = () => ({}),
  ratchetDecryptFn = () => ({}),
  getCurrentUserIdFn = () => null,
} = {}) {
  function withV1SessionLock(userId, fn) {
    const prev = sessionLocks.get(userId) || Promise.resolve();
    let resolve;
    const next = new Promise((r) => { resolve = r; });
    sessionLocks.set(userId, next);
    return prev.then(() => fn().finally(() => {
      if (sessionLocks.get(userId) === next) sessionLocks.delete(userId);
      resolve();
    }));
  }

  async function decryptV1Message(senderUserId, header, ciphertext, nonce, x3dhHeader) {
    if (!isV1StoreReadyFn()) throw new Error('V1 key store not available');

    return withV1SessionLock(senderUserId, async () => {
      const keyStore = getKeyStoreFn();

      if (x3dhHeader) {
        const hasSession = await keyStore?.hasSession?.(senderUserId);
        if (!hasSession) {
          const { sharedSecret, signedPreKeyPair } =
            await processX3DHInitMessageFn(keyStore, x3dhHeader);
          const session = initializeSessionAsBobFn(sharedSecret, signedPreKeyPair);
          await keyStore?.saveSession?.(senderUserId, session);
          sharedSecret?.fill?.(0);
        }
      }

      const session = await keyStore?.getSession?.(senderUserId);
      if (!session) throw new Error(`No v1 session with user ${senderUserId}`);

      try {
        const { plaintext, state: updatedState } =
          ratchetDecryptFn(session, header, ciphertext, nonce, senderUserId, getCurrentUserIdFn());
        await keyStore?.saveSession?.(senderUserId, updatedState);
        return plaintext;
      } catch (err) {
        if (x3dhHeader) {
          const { sharedSecret, signedPreKeyPair } =
            await processX3DHInitMessageFn(keyStore, x3dhHeader);
          const freshSession = initializeSessionAsBobFn(sharedSecret, signedPreKeyPair);
          await keyStore?.saveSession?.(senderUserId, freshSession);
          sharedSecret?.fill?.(0);

          const { plaintext, state: updatedState } =
            ratchetDecryptFn(freshSession, header, ciphertext, nonce, senderUserId, getCurrentUserIdFn());
          await keyStore?.saveSession?.(senderUserId, updatedState);
          return plaintext;
        }
        throw err;
      }
    });
  }

  return {
    decryptV1Message,
  };
}
