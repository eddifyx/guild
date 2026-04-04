function applyConnectedState(state, connection) {
  state.signer = connection.signer;
  state.clientSecretKey = connection.clientSecretKey;
  state.userPubkey = connection.userPubkey;
  state.loginMode = connection.loginMode;
}

function clearRuntimeState(state, { clearNsec = true } = {}) {
  state.signer = null;
  state.clientSecretKey = null;
  state.userPubkey = null;
  state.loginMode = null;
  if (clearNsec) {
    state.nsecKey = null;
  }
}

export function createNostrConnectFacadeRuntime({
  state = {},
  deps = {},
  constants = {},
} = {}) {
  const {
    signTimeoutMs = 15000,
    relayCooldownMs = 500,
    relays = ['wss://nos.lol'],
    perms = [],
    appName = '/guild',
  } = constants;
  const {
    connectWithBunkerFlowFn = async () => ({}),
    parseBunkerInputFn = () => null,
    pushTraceFn = () => {},
    redactTraceValueFn = (value) => value,
    generateSecretKeyFn = () => null,
    createSignerFromBunkerFn = async () => null,
    waitForCooldownFn = async () => {},
    resolveSignerPublicKeyFn = async () => null,
    persistSessionFn = async () => {},
    nip19EncodeFn = (value) => value,
    resetSignerStateFn = async () => {},
    reconnectNostrConnectStateFn = async () => ({ restored: false, error: null }),
    summarizeErrorFn = (error) => error,
    consoleWarnFn = () => {},
    createNostrConnectSessionDescriptorFn = () => ({ uri: '', clientSecretKey: null }),
    waitForNostrConnectSessionConnectionFn = async () => ({}),
    createSignerFromURIFn = async () => null,
    activateNsecStateFn = () => ({ nsecKey: null, userPubkey: null, loginMode: null }),
    getPublicKeyFn = () => null,
    disconnectNostrConnectStateFn = async () => ({
      signer: null,
      clientSecretKey: null,
      nsecKey: null,
      userPubkey: null,
      loginMode: null,
    }),
    loadNsecFn = async () => null,
    loadSessionFn = async () => null,
    buildSignerFromSessionFn = async () => null,
  } = deps;

  async function connectWithBunkerURI(bunkerInput) {
    const connection = await connectWithBunkerFlowFn({
      bunkerInput,
      currentSigner: state.signer,
      currentClientSecretKey: state.clientSecretKey,
      parseBunkerInputFn,
      pushTraceFn,
      redactTraceValueFn,
      generateSecretKeyFn,
      createSignerFromBunkerFn,
      waitForCooldownFn,
      resolveSignerPublicKeyFn,
      persistSessionFn,
      nip19EncodeFn,
      resetSignerStateFn,
    });

    applyConnectedState(state, connection);
    return connection.result;
  }

  async function reconnect() {
    const result = await reconnectNostrConnectStateFn({
      loadNsecFn,
      loadSessionFn,
      buildSignerFromSessionFn,
      resolveSignerPublicKeyFn: (signer, options) => (
        resolveSignerPublicKeyFn(signer, {
          timeoutMs: signTimeoutMs,
          ...options,
        })
      ),
      pushTraceFn,
      redactTraceValueFn,
      summarizeErrorFn,
      zeroKeyFn: deps.zeroKeyFn,
      persistSessionFn,
    });

    if (!result.restored) {
      if (result.error) {
        consoleWarnFn('[NIP-46] Reconnect failed:', result.error.message);
      }
      clearRuntimeState(state);
      return false;
    }

    state.signer = result.signer;
    state.clientSecretKey = result.clientSecretKey;
    state.nsecKey = result.nsecKey;
    state.userPubkey = result.userPubkey;
    state.loginMode = result.loginMode;
    return true;
  }

  function createNostrConnectSession({ abortSignal, onConnected } = {}) {
    const previousSigner = state.signer;
    const previousClientSecretKey = state.clientSecretKey;

    state.signer = null;
    state.clientSecretKey = null;
    state.userPubkey = null;
    state.loginMode = null;

    void resetSignerStateFn({
      signer: previousSigner,
      clientSecretKey: previousClientSecretKey,
      closeSignerFn: async (signer) => signer?.close?.(),
      zeroKeyFn: deps.zeroKeyFn,
    });

    const descriptor = createNostrConnectSessionDescriptorFn({
      generateSecretKeyFn,
      getPublicKeyFn,
      bytesToHexFn: deps.bytesToHexFn,
      createNostrConnectURIFn: deps.createNostrConnectURIFn,
      relays: [...relays],
      perms,
      name: appName,
      pushTraceFn,
      redactTraceValueFn,
      hasAbortSignal: Boolean(abortSignal),
    });

    const waitForConnection = async () => {
      const connection = await waitForNostrConnectSessionConnectionFn({
        clientSecretKey: descriptor.clientSecretKey,
        uri: descriptor.uri,
        abortSignal: abortSignal || 300000,
        onConnected,
        createSignerFromURIFn,
        resolveSignerPublicKeyFn: (signer, options) => (
          resolveSignerPublicKeyFn(signer, {
            timeoutMs: signTimeoutMs,
            ...options,
          })
        ),
        persistSessionFn,
        nip19EncodeFn,
        pushTraceFn,
        redactTraceValueFn,
        summarizeErrorFn,
        closeSignerFn: async (signer) => signer?.close?.(),
      });

      applyConnectedState(state, connection);
      return connection.result;
    };

    return { uri: descriptor.uri, waitForConnection };
  }

  function activateNsec(secretKey) {
    const nextState = activateNsecStateFn(secretKey, {
      getPublicKeyFn,
    });
    state.nsecKey = nextState.nsecKey;
    state.userPubkey = nextState.userPubkey;
    state.loginMode = nextState.loginMode;
  }

  async function disconnect() {
    const nextState = await disconnectNostrConnectStateFn({
      signer: state.signer,
      clientSecretKey: state.clientSecretKey,
      nsecKey: state.nsecKey,
      loginMode: state.loginMode,
      userPubkey: state.userPubkey,
      zeroKeyFn: deps.zeroKeyFn,
      clearSessionFn: deps.clearSessionFn,
      clearNsecFn: deps.clearNsecFn,
      pushTraceFn,
      redactTraceValueFn,
    });

    state.signer = nextState.signer;
    state.clientSecretKey = nextState.clientSecretKey;
    state.nsecKey = nextState.nsecKey;
    state.userPubkey = nextState.userPubkey;
    state.loginMode = nextState.loginMode;
  }

  return {
    connectWithBunkerURI,
    reconnect,
    createNostrConnectSession,
    activateNsec,
    disconnect,
    relayCooldownMs,
  };
}
