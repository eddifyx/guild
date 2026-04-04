export const SIGNAL_SESSION_READY_EVENT = 'signal-session-ready';

export function normalizeSignalBundleBootstrapError(error) {
  const message = error?.message || String(error || '');
  if (/no kyber prekeys|cannot establish pqxdh session/i.test(message)) {
    const normalized = new Error(
      'This recipient has not finished secure messaging setup yet. Ask them to reopen /guild and try again.'
    );
    normalized.retryable = true;
    normalized.cause = error;
    return normalized;
  }
  return error;
}

function getRuntimeWindow(windowObj) {
  if (windowObj) return windowObj;
  if (typeof window !== 'undefined') return window;
  return null;
}

export function emitSignalSessionReady({
  userId,
  deviceId = 1,
  windowObj,
} = {}) {
  if (!userId) return false;

  const runtimeWindow = getRuntimeWindow(windowObj);
  const CustomEventCtor = runtimeWindow?.CustomEvent || globalThis.CustomEvent;
  if (!runtimeWindow?.dispatchEvent || typeof CustomEventCtor !== 'function') {
    return false;
  }

  runtimeWindow.dispatchEvent(new CustomEventCtor(SIGNAL_SESSION_READY_EVENT, {
    detail: {
      userId,
      deviceId: Number(deviceId) || 1,
    },
  }));
  return true;
}

export async function bootstrapSignalSessionFromVerifiedBundle({
  recipientId,
  recipientDeviceId = 1,
  currentUserId = null,
  force = false,
  fetchVerifiedPreKeyBundleFn,
  deleteSessionFn,
  approveIdentityFn,
  processBundleFn,
  emitSignalSessionReadyFn = emitSignalSessionReady,
} = {}) {
  if (force) {
    try {
      await deleteSessionFn?.(recipientId, recipientDeviceId);
    } catch {}
  }

  const bundle = await fetchVerifiedPreKeyBundleFn?.(recipientId, recipientDeviceId);
  const normalizedDeviceId = Number(bundle?.deviceId) || recipientDeviceId || 1;

  if (recipientId === currentUserId) {
    try {
      await approveIdentityFn?.(recipientId, normalizedDeviceId, bundle.identityKey, { verified: false });
    } catch {}
  }

  try {
    await processBundleFn?.(recipientId, normalizedDeviceId, bundle);
  } catch (error) {
    const message = error?.message || String(error || '');
    if (recipientId !== currentUserId || !/untrusted identity/i.test(message)) {
      throw normalizeSignalBundleBootstrapError(error);
    }

    try {
      await deleteSessionFn?.(recipientId, normalizedDeviceId);
    } catch {}
    try {
      await approveIdentityFn?.(recipientId, normalizedDeviceId, bundle.identityKey, { verified: false });
    } catch {}
    try {
      await processBundleFn?.(recipientId, normalizedDeviceId, bundle);
    } catch (retryError) {
      throw normalizeSignalBundleBootstrapError(retryError);
    }
  }

  emitSignalSessionReadyFn?.({
    userId: recipientId,
    deviceId: normalizedDeviceId,
  });

  return normalizedDeviceId;
}

export async function ensureVerifiedSignalSession({
  recipientId,
  recipientDeviceId = 1,
  identityRecord = null,
  currentUserId = null,
  sessionBootstrapRecipients,
  requireTrustedNpubFn,
  getAddressKeyFn,
  hasSessionFn,
  verifyAndApproveIdentityFn,
  fetchVerifiedIdentityFn,
  bootstrapSessionFromVerifiedBundleFn,
} = {}) {
  await requireTrustedNpubFn?.(recipientId, { quarantineSession: true });

  const addressKey = getAddressKeyFn?.(recipientId, recipientDeviceId);
  let hasSession = await hasSessionFn?.(recipientId, recipientDeviceId);

  if (!sessionBootstrapRecipients?.has(addressKey)) {
    if (hasSession) {
      if (identityRecord) {
        await verifyAndApproveIdentityFn?.(recipientId, recipientDeviceId, identityRecord);
      } else {
        await fetchVerifiedIdentityFn?.(recipientId, recipientDeviceId);
      }
      hasSession = await hasSessionFn?.(recipientId, recipientDeviceId);
      if (hasSession) {
        sessionBootstrapRecipients?.add(addressKey);
        return { bootstrapped: false, addressKey };
      }
    }

    await bootstrapSessionFromVerifiedBundleFn?.(recipientId, recipientDeviceId);
    sessionBootstrapRecipients?.add(addressKey);
    return { bootstrapped: true, addressKey };
  }

  if (hasSession) {
    if (identityRecord) {
      await verifyAndApproveIdentityFn?.(recipientId, recipientDeviceId, identityRecord);
    } else {
      await fetchVerifiedIdentityFn?.(recipientId, recipientDeviceId);
    }
    hasSession = await hasSessionFn?.(recipientId, recipientDeviceId);
  }

  if (!hasSession) {
    await bootstrapSessionFromVerifiedBundleFn?.(recipientId, recipientDeviceId);
    return { bootstrapped: true, addressKey };
  }

  return { bootstrapped: false, addressKey };
}

export async function buildSignalDirectMessageEnvelope({
  recipientId,
  plaintext,
  currentUserId = null,
  currentDeviceId = 1,
  listVerifiedDevicesForUserFn,
  listVerifiedSiblingDevicesBestEffortFn,
  buildDirectMessageTargetsFn,
  signalEncryptFn,
  buildDirectMessageEnvelopePayloadFn,
  logWarnFn = console.warn,
} = {}) {
  let refreshedRecipientDevices = [];
  try {
    refreshedRecipientDevices = await listVerifiedDevicesForUserFn?.(recipientId, { forceRefresh: true });
  } catch (error) {
    logWarnFn?.(
      '[Signal] Falling back to cached recipient device identities for DM fanout:',
      error?.message || error,
    );
    refreshedRecipientDevices = await listVerifiedDevicesForUserFn?.(recipientId);
  }

  const [recipientDevices, selfDevices] = await Promise.all([
    Promise.resolve(refreshedRecipientDevices),
    listVerifiedSiblingDevicesBestEffortFn?.(),
  ]);

  const targets = buildDirectMessageTargetsFn?.({
    recipientId,
    recipientDevices,
    selfDevices,
    currentUserId,
  }) || [];

  const copies = [];
  for (const target of targets) {
    const encrypted = await signalEncryptFn?.(target.userId, target.deviceId, plaintext);
    copies.push({
      recipientUserId: target.userId,
      recipientDeviceId: target.deviceId,
      type: encrypted.type,
      payload: encrypted.payload,
    });
  }

  return buildDirectMessageEnvelopePayloadFn?.({
    recipientId,
    senderDeviceId: currentDeviceId || 1,
    copies,
  });
}
