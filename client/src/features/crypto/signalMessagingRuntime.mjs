import {
  buildSignalDirectMessageEnvelope,
  ensureVerifiedSignalSession,
} from './signalSessionRuntime.mjs';

export async function ensureSignalMessageSession({
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
  return ensureVerifiedSignalSession({
    recipientId,
    recipientDeviceId,
    identityRecord,
    currentUserId,
    sessionBootstrapRecipients,
    requireTrustedNpubFn,
    getAddressKeyFn,
    hasSessionFn,
    verifyAndApproveIdentityFn,
    fetchVerifiedIdentityFn,
    bootstrapSessionFromVerifiedBundleFn,
  });
}

export async function encryptSignalMessage({
  recipientId,
  recipientDeviceId = 1,
  plaintext,
  ensureOutboundSignalReadyFn,
  ensureSignalMessageSessionFn,
  encryptFn,
  bootstrapSessionFromVerifiedBundleFn,
  sessionBootstrapRecipients,
  getAddressKeyFn,
  logWarnFn = console.warn,
} = {}) {
  await ensureOutboundSignalReadyFn?.();
  await ensureSignalMessageSessionFn?.(recipientId, recipientDeviceId);
  try {
    return await encryptFn?.(recipientId, recipientDeviceId, plaintext);
  } catch (err) {
    logWarnFn('[Signal] Encrypt failed, refreshing session:', err);
    await bootstrapSessionFromVerifiedBundleFn?.(recipientId, recipientDeviceId, { force: true });
    sessionBootstrapRecipients?.add?.(getAddressKeyFn?.(recipientId, recipientDeviceId));
    return encryptFn?.(recipientId, recipientDeviceId, plaintext);
  }
}

export async function decryptSignalMessage({
  senderId,
  senderDeviceId = 1,
  type,
  payload,
  prekeyMessageType = 3,
  requireTrustedNpubFn,
  fetchVerifiedIdentityFn,
  decryptFn,
} = {}) {
  await requireTrustedNpubFn?.(senderId, { quarantineSession: true });
  if (type === prekeyMessageType) {
    await fetchVerifiedIdentityFn?.(senderId, senderDeviceId);
  }
  return decryptFn?.(senderId, senderDeviceId, type, payload);
}

export async function buildDirectMessageEnvelopeRuntime({
  recipientId,
  plaintext,
  currentUserId = null,
  currentDeviceId = 1,
  ensureOutboundSignalReadyFn,
  listVerifiedDevicesForUserFn,
  listVerifiedSiblingDevicesBestEffortFn,
  buildDirectMessageTargetsFn,
  signalEncryptFn,
  buildDirectMessageEnvelopePayloadFn,
} = {}) {
  if (!currentUserId) {
    throw new Error('Signal user not initialized');
  }
  await ensureOutboundSignalReadyFn?.();
  return buildSignalDirectMessageEnvelope({
    recipientId,
    plaintext,
    currentUserId,
    currentDeviceId,
    listVerifiedDevicesForUserFn,
    listVerifiedSiblingDevicesBestEffortFn,
    buildDirectMessageTargetsFn,
    signalEncryptFn,
    buildDirectMessageEnvelopePayloadFn,
  });
}

async function runOutboundSignalRoomOperation(ensureOutboundSignalReadyFn, operationFn) {
  await ensureOutboundSignalReadyFn?.();
  return operationFn?.();
}

export async function createSignalSenderKeyDistributionMessage({
  roomId,
  ensureOutboundSignalReadyFn,
  createSKDMFn,
} = {}) {
  return runOutboundSignalRoomOperation(
    ensureOutboundSignalReadyFn,
    () => createSKDMFn?.(roomId),
  );
}

export async function encryptSignalGroupMessage({
  roomId,
  plaintext,
  ensureOutboundSignalReadyFn,
  groupEncryptFn,
} = {}) {
  return runOutboundSignalRoomOperation(
    ensureOutboundSignalReadyFn,
    () => groupEncryptFn?.(roomId, plaintext),
  );
}

export async function decryptSignalGroupMessage({
  senderId,
  roomId,
  payload,
  groupDecryptFn,
} = {}) {
  const result = await groupDecryptFn?.(senderId, roomId, payload);
  if (result?.ok === false) {
    const err = new Error(result?.error?.message || 'Group decrypt failed');
    if (result?.error?.code !== undefined) err.code = result.error.code;
    if (result?.error?.operation) err.operation = result.error.operation;
    throw err;
  }
  return result?.plaintext ?? result;
}

export async function rekeySignalRoom({
  roomId,
  ensureOutboundSignalReadyFn,
  rekeyRoomFn,
} = {}) {
  return runOutboundSignalRoomOperation(
    ensureOutboundSignalReadyFn,
    () => rekeyRoomFn?.(roomId),
  );
}
