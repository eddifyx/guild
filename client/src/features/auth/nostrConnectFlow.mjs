export async function resetNostrConnectSignerState({
  signer,
  clientSecretKey,
  closeSignerFn = async (currentSigner) => currentSigner?.close?.(),
  zeroKeyFn = () => {},
} = {}) {
  if (signer) {
    try {
      await closeSignerFn(signer);
    } catch {}
  }
  zeroKeyFn(clientSecretKey);
}

export async function connectWithBunkerFlow({
  bunkerInput,
  currentSigner,
  currentClientSecretKey,
  parseBunkerInputFn,
  pushTraceFn = () => {},
  redactTraceValueFn = (value) => value,
  generateSecretKeyFn,
  createSignerFromBunkerFn,
  waitForCooldownFn = async () => {},
  resolveSignerPublicKeyFn,
  persistSessionFn = async () => {},
  nip19EncodeFn,
  resetSignerStateFn = resetNostrConnectSignerState,
  invalidInputError = 'Invalid bunker URI or NIP-05 identifier',
} = {}) {
  await resetSignerStateFn({
    signer: currentSigner,
    clientSecretKey: currentClientSecretKey,
  });

  const bunkerPointer = await parseBunkerInputFn(bunkerInput);
  if (!bunkerPointer) {
    pushTraceFn('bunker.connect.invalid_input', {});
    throw new Error(invalidInputError);
  }

  pushTraceFn('bunker.connect.start', {
    pubkey: redactTraceValueFn(bunkerPointer.pubkey),
    relays: bunkerPointer.relays,
  });

  const clientSecretKey = generateSecretKeyFn();
  const signer = await createSignerFromBunkerFn(clientSecretKey, bunkerPointer);

  await waitForCooldownFn('after_bunker_connect');

  const userPubkey = await resolveSignerPublicKeyFn(signer, {
    source: 'bunker_uri',
    timeoutMessage: 'Timed out waiting for the signer to share its public key.',
  });

  const persisted = await persistSessionFn(bunkerPointer, clientSecretKey, userPubkey);
  if (!persisted) {
    throw new Error('Failed to persist signer session');
  }

  pushTraceFn('bunker.connect.success', {
    userPubkey: redactTraceValueFn(userPubkey),
  });

  return {
    signer,
    clientSecretKey,
    userPubkey,
    loginMode: 'nip46',
    result: {
      npub: nip19EncodeFn(userPubkey),
      pubkey: userPubkey,
    },
  };
}

export function createNostrConnectSessionDescriptor({
  generateSecretKeyFn,
  getPublicKeyFn,
  bytesToHexFn,
  createNostrConnectURIFn,
  relays,
  perms,
  name = '/guild',
  pushTraceFn = () => {},
  redactTraceValueFn = (value) => value,
  hasAbortSignal = false,
} = {}) {
  const clientSecretKey = generateSecretKeyFn();
  const clientPubkey = getPublicKeyFn(clientSecretKey);
  const secret = bytesToHexFn(generateSecretKeyFn());
  const uri = createNostrConnectURIFn({
    clientPubkey,
    relays,
    secret,
    perms,
    name,
  });

  pushTraceFn('qr.session.created', {
    clientPubkey: redactTraceValueFn(clientPubkey),
    relays,
    perms,
    hasAbortSignal,
  });

  return {
    clientSecretKey,
    clientPubkey,
    secret,
    relays,
    uri,
  };
}

export async function waitForNostrConnectSessionConnection({
  clientSecretKey,
  uri,
  abortSignal,
  onConnected,
  createSignerFromURIFn,
  resolveSignerPublicKeyFn,
  persistSessionFn = async () => {},
  nip19EncodeFn,
  pushTraceFn = () => {},
  redactTraceValueFn = (value) => value,
  summarizeErrorFn = (error) => ({ message: error?.message || String(error) }),
  closeSignerFn = async (signer) => signer?.close?.(),
} = {}) {
  pushTraceFn('qr.wait_for_connection.start', {});
  let signer;

  try {
    signer = await createSignerFromURIFn(clientSecretKey, uri, abortSignal);
    pushTraceFn('qr.wait_for_connection.connected', {});
    onConnected?.();
  } catch (error) {
    pushTraceFn('qr.wait_for_connection.error', {
      error: summarizeErrorFn(error),
    }, 'error');
    throw error;
  }

  if (abortSignal?.aborted) {
    try {
      await closeSignerFn(signer);
    } catch {}
    pushTraceFn('qr.wait_for_connection.aborted', {});
    throw new Error('QR login was cancelled');
  }

  try {
    pushTraceFn('qr.finalize_connection.start', {
      mode: 'from_uri_connected',
    });

    const userPubkey = await resolveSignerPublicKeyFn(signer, {
      source: 'qr_session',
      timeoutMessage: 'Your signer connected, but it did not share its public key in time.',
    });

    const persisted = await persistSessionFn(signer.bp, clientSecretKey, userPubkey);
    if (!persisted) {
      throw new Error('Failed to persist signer session');
    }

    pushTraceFn('qr.finalize_connection.success', {});
    pushTraceFn('qr.wait_for_connection.ready', {
      userPubkey: redactTraceValueFn(userPubkey),
      bunkerPubkey: redactTraceValueFn(signer.bp?.pubkey),
      relays: signer.bp?.relays || [],
    });

    return {
      signer,
      clientSecretKey,
      userPubkey,
      loginMode: 'nip46',
      result: {
        npub: nip19EncodeFn(userPubkey),
        pubkey: userPubkey,
      },
    };
  } catch (error) {
    pushTraceFn('qr.wait_for_connection.finalize_error', {
      error: summarizeErrorFn(error),
    }, 'error');
    try {
      await closeSignerFn(signer);
    } catch {}
    throw error;
  }
}
