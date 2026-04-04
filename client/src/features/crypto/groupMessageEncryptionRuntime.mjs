export function createGroupMessageEncryptionRuntime({
  isE2EInitializedFn,
  importSenderKeysModuleFn = () => import('../../crypto/senderKeys.js'),
} = {}) {
  async function encryptGroupMessage(roomId, textContent, attachmentMeta) {
    if (!isE2EInitializedFn?.()) throw new Error('E2E encryption not initialized');

    const { encryptWithSenderKey } = await importSenderKeysModuleFn();
    return encryptWithSenderKey(roomId, textContent, attachmentMeta);
  }

  async function decryptGroupMessage(roomId, senderUserId, envelopeJson) {
    if (!isE2EInitializedFn?.()) throw new Error('E2E encryption not initialized');

    const { decryptWithSenderKey } = await importSenderKeysModuleFn();
    return decryptWithSenderKey(roomId, senderUserId, envelopeJson);
  }

  return {
    encryptGroupMessage,
    decryptGroupMessage,
  };
}
