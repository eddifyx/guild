import {
  buildDirectMessageEnvelopeRuntime,
  createSignalSenderKeyDistributionMessage,
  decryptSignalGroupMessage,
  decryptSignalMessage,
  encryptSignalGroupMessage,
  encryptSignalMessage,
  rekeySignalRoom,
} from './signalMessagingRuntime.mjs';

export function createSignalClientMessagingFacadeRuntime({
  signalCrypto,
  state,
  signalSessionRuntime,
  signalIdentityRuntime,
  buildDirectMessageEnvelopePayloadFn,
  buildDirectMessageTargetsFn,
  prekeyMessageType = 3,
  encryptSignalMessageFn = encryptSignalMessage,
  decryptSignalMessageFn = decryptSignalMessage,
  buildDirectMessageEnvelopeRuntimeFn = buildDirectMessageEnvelopeRuntime,
  createSignalSenderKeyDistributionMessageFn = createSignalSenderKeyDistributionMessage,
  encryptSignalGroupMessageFn = encryptSignalGroupMessage,
  decryptSignalGroupMessageFn = decryptSignalGroupMessage,
  rekeySignalRoomFn = rekeySignalRoom,
} = {}) {
  async function signalEncrypt(recipientId, recipientDeviceId = 1, plaintext) {
    return encryptSignalMessageFn({
      recipientId,
      recipientDeviceId,
      plaintext,
      ensureOutboundSignalReadyFn: signalSessionRuntime?.ensureOutboundSignalReady,
      ensureSignalMessageSessionFn: (targetUserId, targetDeviceId) =>
        signalSessionRuntime?.ensureVerifiedSession?.(targetUserId, targetDeviceId),
      encryptFn: (targetUserId, targetDeviceId, nextPlaintext) =>
        signalCrypto?.encrypt?.(targetUserId, targetDeviceId, nextPlaintext),
      bootstrapSessionFromVerifiedBundleFn: signalIdentityRuntime?.bootstrapSessionFromVerifiedBundle,
      sessionBootstrapRecipients: signalSessionRuntime?.sessionBootstrapRecipients,
      getAddressKeyFn: signalSessionRuntime?.getAddressKey,
    });
  }

  async function signalDecrypt(senderId, senderDeviceId = 1, type, payload) {
    return decryptSignalMessageFn({
      senderId,
      senderDeviceId,
      type,
      payload,
      prekeyMessageType,
      requireTrustedNpubFn: signalIdentityRuntime?.requireTrustedNpub,
      fetchVerifiedIdentityFn: signalIdentityRuntime?.fetchVerifiedIdentity,
      decryptFn: (targetUserId, targetDeviceId, nextType, nextPayload) =>
        signalCrypto?.decrypt?.(targetUserId, targetDeviceId, nextType, nextPayload),
    });
  }

  async function buildDirectMessageEnvelope(recipientId, plaintext) {
    return buildDirectMessageEnvelopeRuntimeFn({
      recipientId,
      plaintext,
      currentUserId: state?.userId,
      currentDeviceId: state?.deviceId || 1,
      ensureOutboundSignalReadyFn: signalSessionRuntime?.ensureOutboundSignalReady,
      listVerifiedDevicesForUserFn: signalIdentityRuntime?.listVerifiedDevicesForUser,
      listVerifiedSiblingDevicesBestEffortFn: signalIdentityRuntime?.listVerifiedSiblingDevicesBestEffort,
      buildDirectMessageTargetsFn,
      signalEncryptFn: signalEncrypt,
      buildDirectMessageEnvelopePayloadFn,
    });
  }

  async function createSKDM(roomId) {
    return createSignalSenderKeyDistributionMessageFn({
      roomId,
      ensureOutboundSignalReadyFn: signalSessionRuntime?.ensureOutboundSignalReady,
      createSKDMFn: (targetRoomId) => signalCrypto?.createSKDM?.(targetRoomId),
    });
  }

  async function processSKDM(senderId, skdm) {
    return signalCrypto?.processSKDM?.(senderId, skdm);
  }

  async function groupEncrypt(roomId, plaintext) {
    return encryptSignalGroupMessageFn({
      roomId,
      plaintext,
      ensureOutboundSignalReadyFn: signalSessionRuntime?.ensureOutboundSignalReady,
      groupEncryptFn: (targetRoomId, nextPlaintext) =>
        signalCrypto?.groupEncrypt?.(targetRoomId, nextPlaintext),
    });
  }

  async function groupDecrypt(senderId, roomId, payload) {
    return decryptSignalGroupMessageFn({
      senderId,
      roomId,
      payload,
      groupDecryptFn: (targetUserId, targetRoomId, nextPayload) =>
        signalCrypto?.groupDecrypt?.(targetUserId, targetRoomId, nextPayload),
    });
  }

  async function rekeyRoom(roomId) {
    return rekeySignalRoomFn({
      roomId,
      ensureOutboundSignalReadyFn: signalSessionRuntime?.ensureOutboundSignalReady,
      rekeyRoomFn: (targetRoomId) => signalCrypto?.rekeyRoom?.(targetRoomId),
    });
  }

  return {
    signalEncrypt,
    signalDecrypt,
    buildDirectMessageEnvelope,
    createSKDM,
    processSKDM,
    groupEncrypt,
    groupDecrypt,
    rekeyRoom,
  };
}
