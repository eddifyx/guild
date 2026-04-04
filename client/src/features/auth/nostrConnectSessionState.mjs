const NOSTR_SIGNER_STATE_KEY = 'nostr_signer_state';

function normalizeOptionalSignerPubkey(value) {
  return typeof value === 'string' && value.trim()
    ? value.trim().toLowerCase()
    : null;
}

function normalizeOptionalBunkerSecret(value) {
  return typeof value === 'string' && value.trim()
    ? value.trim()
    : null;
}

function removeLegacySignerState(localStorageObject) {
  localStorageObject?.removeItem?.('nostr_nip46_session_enc');
  localStorageObject?.removeItem?.('nostr_nip46_session');
  localStorageObject?.removeItem?.('nostr_nsec_enc');
  localStorageObject?.removeItem?.(NOSTR_SIGNER_STATE_KEY);
}

export function clearNostrConnectSessionStorage({
  localStorageObject = globalThis.localStorage,
  clearSignerStateFn,
} = {}) {
  removeLegacySignerState(localStorageObject);
  return clearSignerStateFn?.();
}

export function clearPersistedNsec({
  localStorageObject = globalThis.localStorage,
  clearSignerStateFn,
} = {}) {
  removeLegacySignerState(localStorageObject);
  return clearSignerStateFn?.();
}

function encodeBase64Bytes(bytes, {
  bufferCtor = globalThis.Buffer,
  btoaFn = globalThis.btoa,
} = {}) {
  if (!(bytes instanceof Uint8Array)) return null;
  if (bufferCtor?.from) {
    return bufferCtor.from(bytes).toString('base64');
  }
  if (typeof btoaFn === 'function') {
    let binary = '';
    for (const value of bytes) {
      binary += String.fromCharCode(value);
    }
    return btoaFn(binary);
  }
  return null;
}

function decodeBase64Bytes(value, {
  bufferCtor = globalThis.Buffer,
  atobFn = globalThis.atob,
} = {}) {
  if (typeof value !== 'string' || !value) return null;
  if (bufferCtor?.from) {
    return new Uint8Array(bufferCtor.from(value, 'base64'));
  }
  if (typeof atobFn === 'function') {
    const binary = atobFn(value);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  }
  return null;
}

function normalizeSignerStateRecord(state) {
  if (!state || typeof state !== 'object') return null;

  if (state.mode === 'nip46') {
    if (typeof state.clientSecretKey !== 'string' || !state.clientSecretKey) return null;
    if (!state.bunkerPointer || typeof state.bunkerPointer !== 'object') return null;
    if (typeof state.bunkerPointer.pubkey !== 'string' || !state.bunkerPointer.pubkey) return null;

    return {
      mode: 'nip46',
      clientSecretKey: state.clientSecretKey,
      userPubkey: normalizeOptionalSignerPubkey(state.userPubkey),
      bunkerPointer: {
        pubkey: state.bunkerPointer.pubkey,
        ...(normalizeOptionalBunkerSecret(state.bunkerPointer.secret)
          ? { secret: normalizeOptionalBunkerSecret(state.bunkerPointer.secret) }
          : {}),
        relays: Array.isArray(state.bunkerPointer.relays)
          ? state.bunkerPointer.relays.filter((relay) => typeof relay === 'string' && relay.length > 0)
          : [],
      },
    };
  }

  if (state.mode === 'nsec') {
    if (typeof state.secretKey !== 'string' || !state.secretKey) return null;
    return {
      mode: 'nsec',
      secretKey: state.secretKey,
      pubkey: typeof state.pubkey === 'string' && state.pubkey ? state.pubkey : null,
    };
  }

  return null;
}

async function writeSignerState(record, {
  localStorageObject = globalThis.localStorage,
  writeSignerStateFn,
} = {}) {
  const normalized = normalizeSignerStateRecord(record);
  if (!normalized) return false;

  if (typeof writeSignerStateFn === 'function') {
    try {
      const persisted = Boolean(await writeSignerStateFn(normalized));
      if (persisted) {
        return true;
      }
    } catch {}
  }

  try {
    localStorageObject?.setItem?.(NOSTR_SIGNER_STATE_KEY, JSON.stringify(normalized));
    return true;
  } catch {
    return false;
  }
}

async function readSignerState({
  localStorageObject = globalThis.localStorage,
  readSignerStateFn,
  writeSignerStateFn,
} = {}) {
  try {
    if (typeof readSignerStateFn === 'function') {
      const persistedState = normalizeSignerStateRecord(await readSignerStateFn());
      if (persistedState) {
        return persistedState;
      }
    }

    const raw = localStorageObject?.getItem?.(NOSTR_SIGNER_STATE_KEY);
    if (!raw) return null;
    const normalized = normalizeSignerStateRecord(JSON.parse(raw));
    if (!normalized) return null;

    if (typeof writeSignerStateFn === 'function') {
      try {
        const migrated = Boolean(await writeSignerStateFn(normalized));
        if (migrated) {
          removeLegacySignerState(localStorageObject);
        }
      } catch {}
    }

    return normalized;
  } catch {
    return null;
  }
}

export async function persistNip46Session(
  bunkerPointer,
  clientSecretKey,
  userPubkeyOrOptions = {},
  maybeOptions = {},
) {
  const hasExplicitUserPubkey = typeof userPubkeyOrOptions === 'string';
  const userPubkey = hasExplicitUserPubkey
    ? normalizeOptionalSignerPubkey(userPubkeyOrOptions)
    : null;
  const {
    clearSessionFn = clearNostrConnectSessionStorage,
    writeSignerStateFn,
    localStorageObject = globalThis.localStorage,
    pushTraceFn = () => {},
    redactTraceValueFn = (value) => value,
  } = hasExplicitUserPubkey ? maybeOptions : (userPubkeyOrOptions || {});
  const encodedSecret = encodeBase64Bytes(clientSecretKey);
  if (!encodedSecret || typeof bunkerPointer?.pubkey !== 'string') {
    await Promise.resolve(clearSessionFn({
      localStorageObject,
    }));
    return false;
  }

  const persisted = await writeSignerState({
    mode: 'nip46',
    ...(userPubkey ? { userPubkey } : {}),
    bunkerPointer: {
      pubkey: bunkerPointer.pubkey,
      ...(normalizeOptionalBunkerSecret(bunkerPointer.secret)
        ? { secret: normalizeOptionalBunkerSecret(bunkerPointer.secret) }
        : {}),
      relays: Array.isArray(bunkerPointer.relays) ? bunkerPointer.relays : [],
    },
    clientSecretKey: encodedSecret,
  }, {
    localStorageObject,
    writeSignerStateFn,
  });

  if (persisted) {
    pushTraceFn('session.persist.nip46', {
      bunkerPubkey: redactTraceValueFn(bunkerPointer.pubkey),
      relays: bunkerPointer.relays || [],
    });
    return true;
  }
  return false;
}

export async function loadPersistedNip46Session({
  clearSessionFn = clearNostrConnectSessionStorage,
  localStorageObject = globalThis.localStorage,
  readSignerStateFn,
  writeSignerStateFn,
} = {}) {
  const storedState = await readSignerState({
    localStorageObject,
    readSignerStateFn,
    writeSignerStateFn,
  });
  if (!storedState) return null;
  if (storedState.mode !== 'nip46') return null;

  const clientSecretKey = decodeBase64Bytes(storedState.clientSecretKey);
  if (!clientSecretKey || typeof storedState.bunkerPointer?.pubkey !== 'string') {
    await Promise.resolve(clearSessionFn({
      localStorageObject,
    }));
    return null;
  }

  return {
    clientSecretKey,
    userPubkey: normalizeOptionalSignerPubkey(storedState.userPubkey),
    bunkerPointer: {
      pubkey: storedState.bunkerPointer.pubkey,
      ...(normalizeOptionalBunkerSecret(storedState.bunkerPointer.secret)
        ? { secret: normalizeOptionalBunkerSecret(storedState.bunkerPointer.secret) }
        : {}),
      relays: Array.isArray(storedState.bunkerPointer.relays)
        ? storedState.bunkerPointer.relays
        : [],
    },
  };
}

export async function persistNsec(secretKey, {
  clearNsecFn = clearPersistedNsec,
  getPublicKeyFn = () => null,
  writeSignerStateFn,
  localStorageObject = globalThis.localStorage,
} = {}) {
  const encodedSecret = encodeBase64Bytes(secretKey);
  if (!encodedSecret) {
    await Promise.resolve(clearNsecFn({
      localStorageObject,
    }));
    return false;
  }

  const persisted = await writeSignerState({
    mode: 'nsec',
    secretKey: encodedSecret,
    pubkey: getPublicKeyFn(secretKey),
  }, {
    localStorageObject,
    writeSignerStateFn,
  });

  if (persisted) return true;
  return false;
}

export async function loadPersistedNsec({
  clearNsecFn = clearPersistedNsec,
  localStorageObject = globalThis.localStorage,
  readSignerStateFn,
  writeSignerStateFn,
} = {}) {
  const storedState = await readSignerState({
    localStorageObject,
    readSignerStateFn,
    writeSignerStateFn,
  });
  if (!storedState) return null;
  if (storedState.mode !== 'nsec') return null;

  const secretKey = decodeBase64Bytes(storedState.secretKey);
  if (!secretKey) {
    await Promise.resolve(clearNsecFn({
      localStorageObject,
    }));
    return null;
  }

  return {
    secretKey,
    pubkey: typeof storedState.pubkey === 'string' ? storedState.pubkey : null,
  };
}

export function buildNsecSigner(secretKey, {
  finalizeEventFn,
  getPublicKeyFn,
  nip04EncryptFn,
  nip44EncryptFn,
  getNip44ConversationKeyFn,
} = {}) {
  return {
    signEvent: (template) => Promise.resolve(finalizeEventFn(template, secretKey)),
    getPublicKey: () => Promise.resolve(getPublicKeyFn(secretKey)),
    nip04Encrypt: (pubkey, plaintext) => nip04EncryptFn(secretKey, pubkey, plaintext),
    nip44Encrypt: (pubkey, plaintext) => nip44EncryptFn(
      plaintext,
      getNip44ConversationKeyFn(secretKey, pubkey),
    ),
  };
}

export function activateNsecState(secretKey, {
  getPublicKeyFn,
} = {}) {
  return {
    nsecKey: secretKey,
    userPubkey: getPublicKeyFn(secretKey),
    loginMode: 'nsec',
  };
}

export async function reconnectNostrConnectState({
  loadNsecFn,
  loadSessionFn,
  buildSignerFromSessionFn,
  resolveSignerPublicKeyFn,
  persistSessionFn = async () => {},
  pushTraceFn = () => {},
  redactTraceValueFn = (value) => value,
  summarizeErrorFn = (error) => ({ message: error?.message || String(error) }),
  zeroKeyFn = () => {},
} = {}) {
  const nsecData = await loadNsecFn();
  if (nsecData) {
    pushTraceFn('session.reconnect.nsec', {
      userPubkey: redactTraceValueFn(nsecData.pubkey),
    });
    return {
      restored: true,
      signer: null,
      clientSecretKey: null,
      userPubkey: nsecData.pubkey,
      nsecKey: nsecData.secretKey,
      loginMode: 'nsec',
    };
  }

  const session = await loadSessionFn();
  if (!session) return { restored: false };

  try {
    pushTraceFn('session.reconnect.nip46.start', {
      bunkerPubkey: redactTraceValueFn(session.bunkerPointer?.pubkey),
      relays: session.bunkerPointer?.relays || [],
    });

    const signer = await buildSignerFromSessionFn(session);
    const userPubkey = await resolveSignerPublicKeyFn(signer, {
      source: 'session_reconnect',
      knownPubkey: null,
      timeoutMessage: 'Timed out waiting for the signer to restore its public key.',
    });

    await Promise.resolve(
      persistSessionFn(session.bunkerPointer, session.clientSecretKey, userPubkey)
    ).catch(() => {});

    pushTraceFn('session.reconnect.nip46.success', {
      userPubkey: redactTraceValueFn(userPubkey),
    });

    return {
      restored: true,
      signer,
      clientSecretKey: session.clientSecretKey,
      userPubkey,
      nsecKey: null,
      loginMode: 'nip46',
    };
  } catch (error) {
    pushTraceFn('session.reconnect.nip46.error', {
      error: summarizeErrorFn(error),
    }, 'warn');
    zeroKeyFn(session.clientSecretKey);
    return {
      restored: false,
      signer: null,
      clientSecretKey: null,
      userPubkey: null,
      nsecKey: null,
      loginMode: null,
      error,
    };
  }
}

export async function disconnectNostrConnectState({
  signer,
  clientSecretKey,
  nsecKey,
  loginMode,
  userPubkey,
  closeSignerFn = async (currentSigner) => currentSigner?.close?.(),
  zeroKeyFn = () => {},
  clearSessionFn = clearNostrConnectSessionStorage,
  clearNsecFn = clearPersistedNsec,
  pushTraceFn = () => {},
  redactTraceValueFn = (value) => value,
} = {}) {
  if (signer) {
    try {
      await closeSignerFn(signer);
    } catch {}
  }

  pushTraceFn('session.disconnect', {
    loginMode,
    userPubkey: redactTraceValueFn(userPubkey),
  });

  zeroKeyFn(clientSecretKey);
  zeroKeyFn(nsecKey);
  await Promise.resolve(clearSessionFn());
  await Promise.resolve(clearNsecFn());

  return {
    signer: null,
    clientSecretKey: null,
    nsecKey: null,
    userPubkey: null,
    loginMode: null,
  };
}

export const persistDisabledNip46Session = persistNip46Session;
export const loadDisabledNip46Session = loadPersistedNip46Session;
export const persistDisabledNsec = persistNsec;
export const loadDisabledNsec = loadPersistedNsec;
