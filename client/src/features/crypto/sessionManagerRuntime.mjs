export function removeLegacyV1MasterKey(userId, storage = globalThis?.localStorage) {
  const storageKey = `byzantine-mk-${userId}`;
  storage?.removeItem?.(storageKey);
  return null;
}

export function createSessionManagerRuntime({
  state = {
    initialized: false,
    e2eExpected: false,
    userId: null,
    initPromise: null,
    v1StoreReady: false,
    lifecycleVersion: 0,
  },
  initializeSignalCryptoFn = async () => {},
  destroySignalCryptoFn = async () => {},
  getKeyStoreFn = () => null,
  resetKeyStoreFn = () => {},
  clearSessionLocksFn = () => {},
  loadExistingV1MasterKeyFn = removeLegacyV1MasterKey,
} = {}) {
  async function doInit(authData, lifecycleVersion, options = {}) {
    await initializeSignalCryptoFn(authData, options);
    if (lifecycleVersion !== state.lifecycleVersion) return;

    let v1StoreReady = false;
    try {
      const masterKey = await loadExistingV1MasterKeyFn(authData.userId);
      if (masterKey) {
        const keyStore = getKeyStoreFn();
        await keyStore?.initialize?.(masterKey);
        masterKey.fill?.(0);
        v1StoreReady = true;
      }
    } catch {
      v1StoreReady = false;
    }

    if (lifecycleVersion !== state.lifecycleVersion) return;

    state.v1StoreReady = v1StoreReady;
    state.initialized = true;
    state.userId = authData.userId;
  }

  async function initializeCryptoIdentity(authData, options = {}) {
    state.e2eExpected = true;
    if (state.initialized && state.userId === authData.userId) return;
    if (state.initPromise) return state.initPromise;

    const lifecycleVersion = state.lifecycleVersion;
    const initPromise = doInit(authData, lifecycleVersion, options);
    const trackedPromise = initPromise.finally(() => {
      if (state.initPromise === trackedPromise) state.initPromise = null;
    });

    state.initPromise = trackedPromise;
    return trackedPromise;
  }

  async function destroyCryptoState() {
    const inFlightInit = state.initPromise;
    state.lifecycleVersion += 1;
    state.initialized = false;
    state.e2eExpected = false;
    state.userId = null;
    state.v1StoreReady = false;
    clearSessionLocksFn();

    if (inFlightInit) {
      await inFlightInit.catch(() => {});
    }

    await destroySignalCryptoFn();
    resetKeyStoreFn();
    state.initPromise = null;
  }

  return {
    initializeCryptoIdentity,
    destroyCryptoState,
    isE2EInitialized: () => state.initialized,
    wasE2EExpected: () => state.e2eExpected && !state.initialized,
    getCurrentUserId: () => state.userId,
    isV1StoreReady: () => state.v1StoreReady,
  };
}
