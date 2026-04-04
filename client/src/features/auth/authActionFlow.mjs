export function createAuthActions({
  connectWithBunkerURI,
  decodeNsec,
  activateNsec,
  getSigner,
  authenticateWithServer,
  completeAuthenticatedLogin,
  finalizeCreatedAccountProfile,
  uploadImage,
  publishProfile,
  apiRequest,
  persistAuth,
  setUser,
  clearLocalSession,
  pushTrace,
  redactTraceValue,
  summarizeError,
} = {}) {
  const traceError = async (step, err) => {
    pushTrace?.(step, {
      error: summarizeError?.(err) || err?.message || String(err),
    }, 'error');
    await clearLocalSession?.().catch?.(() => {});
    throw err;
  };

  return {
    async nostrLogin(bunkerInput) {
      try {
        pushTrace?.('login.nostr_bunker.start', {});
        const { npub, pubkey } = await connectWithBunkerURI(bunkerInput);
        const signer = getSigner?.();
        if (!signer) throw new Error('Signer not connected');

        return completeAuthenticatedLogin(
          await authenticateWithServer(pubkey, npub, signer)
        );
      } catch (err) {
        return traceError('login.nostr_bunker.error', err);
      }
    },

    async nostrConnectLogin(connectResult) {
      try {
        pushTrace?.('login.nostr_connect.start', {
          pubkey: redactTraceValue?.(connectResult?.pubkey),
          npub: redactTraceValue?.(connectResult?.npub),
        });
        const signer = getSigner?.();
        if (!signer) throw new Error('Signer not connected');

        return completeAuthenticatedLogin(
          await authenticateWithServer(connectResult.pubkey, connectResult.npub, signer)
        );
      } catch (err) {
        return traceError('login.nostr_connect.error', err);
      }
    },

    async nsecLogin(nsecStr) {
      const { secretKey, pubkey, npub } = decodeNsec(nsecStr);

      try {
        await activateNsec?.(secretKey);
        pushTrace?.('login.nsec.start', {
          pubkey: redactTraceValue?.(pubkey),
          npub: redactTraceValue?.(npub),
        });

        return completeAuthenticatedLogin(
          await authenticateWithServer(pubkey, npub, secretKey)
        );
      } catch (err) {
        return traceError('login.nsec.error', err);
      }
    },

    async createAccount({ nsec, profile = null, profileImageFile = null } = {}) {
      const { secretKey, pubkey, npub } = decodeNsec(nsec);

      try {
        await activateNsec?.(secretKey);
        pushTrace?.('login.nsec_create.start', {
          pubkey: redactTraceValue?.(pubkey),
          npub: redactTraceValue?.(npub),
          hasProfile: Boolean(profile),
          hasProfileImageFile: Boolean(profileImageFile),
        });

        const authData = await completeAuthenticatedLogin(
          await authenticateWithServer(pubkey, npub, secretKey)
        );

        const result = await finalizeCreatedAccountProfile({
          authData,
          profile,
          profileImageFile,
          uploadImage,
          publishProfile,
          apiRequest,
          persistAuth,
        });

        setUser?.(result.authData);
        return result;
      } catch (err) {
        return traceError('login.nsec_create.error', err);
      }
    },
  };
}
