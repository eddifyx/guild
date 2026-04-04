import { createSocketRoomSenderKeyRuntime } from './socketRoomSenderKeyRuntime.mjs';
import { createSocketEncryptedControlRuntime } from './socketEncryptedControlRuntime.mjs';

async function importIdentityDirectory() {
  return import('../../crypto/identityDirectory.js');
}

async function importMessageEncryption() {
  return import('../../crypto/messageEncryption.js');
}

async function importSenderKeys() {
  return import('../../crypto/senderKeys.js');
}

async function importVoiceEncryption() {
  return import('../../crypto/voiceEncryption.js');
}

export function createSocketControlRuntime({
  apiRequestFn = async () => null,
  importIdentityDirectoryFn = importIdentityDirectory,
  importMessageEncryptionFn = importMessageEncryption,
  importSenderKeysFn = importSenderKeys,
  importVoiceEncryptionFn = importVoiceEncryption,
  nowFn = () => Date.now(),
  setIntervalFn,
  clearIntervalFn,
  createCustomEventFn,
  dispatchEventFn,
  warnFn,
  importSessionManagerFn,
} = {}) {
  const encryptedControlRuntime = createSocketEncryptedControlRuntime({
    apiRequestFn,
    importSessionManagerFn,
    importIdentityDirectoryFn,
    importMessageEncryptionFn,
    importSenderKeysFn,
    importVoiceEncryptionFn,
    nowFn,
    setIntervalFn,
    clearIntervalFn,
    createCustomEventFn,
    dispatchEventFn,
    warnFn,
  });

  const roomSenderKeyRuntime = createSocketRoomSenderKeyRuntime({
    apiRequestFn,
    importSessionManagerFn,
    processEncryptedControlMessageFn: encryptedControlRuntime.processEncryptedControlMessage,
    queuePendingControlMessageFn: encryptedControlRuntime.queuePendingControlMessage,
    shouldAcknowledgeSenderKeyErrorFn: encryptedControlRuntime.shouldAcknowledgeSenderKeyError,
    acknowledgeSenderKeyReceiptsFn: encryptedControlRuntime.acknowledgeSenderKeyReceipts,
    nowFn,
    warnFn,
  });

  function createDirectSenderKeyHandler() {
    return async ({ id, fromUserId, senderNpub, envelope, roomId, distributionId }) => {
      try {
        const entry = { id, fromUserId, senderNpub, envelope, roomId, distributionId };
        const result = await encryptedControlRuntime.processEncryptedControlMessage(entry);
        await encryptedControlRuntime.acknowledgeProcessedControlMessage(entry, result);
      } catch (err) {
        encryptedControlRuntime.queuePendingControlMessage({
          id,
          fromUserId,
          senderNpub,
          envelope,
          roomId,
          distributionId,
          lastError: err?.message || 'Processing failed',
        });
      }
    };
  }

  function createRoomMemberRemovedHandler() {
    return async ({ roomId }) => {
      try {
        const { isE2EInitialized } = await importSessionManagerFn();
        if (!isE2EInitialized()) return;

        const { rekeyRoom } = await importSenderKeysFn();
        await rekeyRoom(roomId);
      } catch (err) {
        // Rekey failure is non-fatal; the next message send will try again.
      }
    };
  }

  function createRoomSenderKeyRequestedHandler() {
    return async ({ roomId }) => {
      try {
        const { isE2EInitialized } = await importSessionManagerFn();
        if (!isE2EInitialized()) return;

        const { redistributeSenderKey } = await importSenderKeysFn();
        await redistributeSenderKey(roomId);
      } catch (err) {
        warnFn('[E2E] Failed to redistribute sender key on request:', err?.message || err);
      }
    };
  }

  function handleSocketConnect() {
    encryptedControlRuntime.handleSocketConnect();
  }

  function handleSocketDisconnect() {
    roomSenderKeyRuntime.clearPendingRoomSenderKeyRequests();
  }

  function reset() {
    encryptedControlRuntime.reset();
    roomSenderKeyRuntime.clearPendingRoomSenderKeyRequests();
  }

  function getStateSnapshot() {
    const controlSnapshot = encryptedControlRuntime.getStateSnapshot();
    const roomSnapshot = roomSenderKeyRuntime.getStateSnapshot();
    return {
      pendingControlMessageCount: controlSnapshot.pendingControlMessageCount,
      pendingRoomSenderKeySyncCount: roomSnapshot.pendingRoomSenderKeySyncCount,
      pendingRoomSenderKeyRequestCount: roomSnapshot.pendingRoomSenderKeyRequestCount,
      retryLoopActive: controlSnapshot.retryLoopActive,
    };
  }

  return {
    clearPendingRoomSenderKeyRequests: roomSenderKeyRuntime.clearPendingRoomSenderKeyRequests,
    createDirectSenderKeyHandler,
    createRoomMemberRemovedHandler,
    createRoomSenderKeyRequestedHandler,
    flushPendingControlMessages: encryptedControlRuntime.flushPendingControlMessages,
    flushPendingControlMessagesNow: encryptedControlRuntime.flushPendingControlMessagesNow,
    getStateSnapshot,
    handleSocketConnect,
    handleSocketDisconnect,
    processEncryptedControlMessage: encryptedControlRuntime.processEncryptedControlMessage,
    queuePendingControlMessage: encryptedControlRuntime.queuePendingControlMessage,
    requestRoomSenderKey: roomSenderKeyRuntime.requestRoomSenderKey,
    reset,
    syncRoomSenderKeys: roomSenderKeyRuntime.syncRoomSenderKeys,
  };
}
