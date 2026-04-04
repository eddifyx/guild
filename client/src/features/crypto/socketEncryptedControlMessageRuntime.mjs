function defaultCreateCustomEvent(type, detail) {
  if (typeof globalThis.CustomEvent === 'function') {
    return new globalThis.CustomEvent(type, { detail });
  }
  return { type, detail };
}

function defaultDispatchEvent(event) {
  globalThis.window?.dispatchEvent?.(event);
}

async function importSessionManager() {
  return import('../../crypto/sessionManager.js');
}

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

function defaultWarn(...args) {
  globalThis.console?.warn?.(...args);
}

export function createSocketEncryptedControlMessageRuntime({
  apiRequestFn = async () => null,
  importSessionManagerFn = importSessionManager,
  importIdentityDirectoryFn = importIdentityDirectory,
  importMessageEncryptionFn = importMessageEncryption,
  importSenderKeysFn = importSenderKeys,
  importVoiceEncryptionFn = importVoiceEncryption,
  createCustomEventFn = defaultCreateCustomEvent,
  dispatchEventFn = defaultDispatchEvent,
  warnFn = defaultWarn,
} = {}) {
  async function processEncryptedControlMessage({ fromUserId, senderNpub, envelope }) {
    const { isE2EInitialized } = await importSessionManagerFn();
    if (!isE2EInitialized()) {
      const err = new Error('E2E not initialized yet');
      err.retryable = true;
      throw err;
    }

    if (senderNpub) {
      const { rememberUserNpub } = await importIdentityDirectoryFn();
      rememberUserNpub(fromUserId, senderNpub);
    }

    const { decryptDirectMessage } = await importMessageEncryptionFn();
    const decrypted = await decryptDirectMessage(fromUserId, envelope);
    const payload = JSON.parse(decrypted.body);

    if (payload.type === 'sender_key_distribution') {
      const { processDecryptedSenderKey } = await importSenderKeysFn();
      await processDecryptedSenderKey(fromUserId, payload);
      dispatchEventFn(createCustomEventFn('sender-key-updated', {
        roomId: payload.roomId,
        senderUserId: fromUserId,
      }));
      return {
        handled: true,
        type: payload.type,
        roomId: payload.roomId || null,
      };
    }

    if (payload.type === 'voice_key_distribution') {
      const { processDecryptedVoiceKey } = await importVoiceEncryptionFn();
      const applied = await processDecryptedVoiceKey(fromUserId, payload);
      if (applied) {
        dispatchEventFn(createCustomEventFn('voice-key-updated', {
          channelId: payload.channelId,
          epoch: payload.epoch,
          fromUserId,
        }));
      }
      return {
        handled: applied,
        type: payload.type,
        channelId: payload.channelId || null,
      };
    }

    return {
      handled: false,
      type: payload.type || 'unknown',
    };
  }

  function shouldAcknowledgeSenderKeyError(err) {
    const message = String(err?.message || '');
    return message.includes('DuplicatedMessage')
      || message.includes('old counter')
      || message.includes('rollback rejected');
  }

  async function acknowledgeSenderKeyReceipts(roomId, ids) {
    if (!roomId || !Array.isArray(ids) || ids.length === 0) return;
    try {
      await apiRequestFn(`/api/rooms/${encodeURIComponent(roomId)}/sender-keys/ack`, {
        method: 'POST',
        body: JSON.stringify({ ids }),
      });
    } catch (err) {
      warnFn('[E2E] Failed to acknowledge sender key receipt:', err?.message || err);
    }
  }

  async function acknowledgeProcessedControlMessage(entry, result, err = null) {
    const roomId = entry?.roomId || result?.roomId || null;
    if (!entry?.id || !roomId) return;
    if (err && !shouldAcknowledgeSenderKeyError(err)) return;
    if (!err && result?.type !== 'sender_key_distribution') return;
    await acknowledgeSenderKeyReceipts(roomId, [entry.id]);
  }

  return {
    acknowledgeProcessedControlMessage,
    acknowledgeSenderKeyReceipts,
    processEncryptedControlMessage,
    shouldAcknowledgeSenderKeyError,
  };
}
