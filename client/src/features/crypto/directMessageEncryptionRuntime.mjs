import { fromBase64 } from '../../crypto/primitives.js';

export function createDirectMessageEncryptionRuntime({
  isE2EInitializedFn,
  isV1StoreReadyFn,
  buildDirectMessageEnvelopeFn,
  getSignalUserIdFn,
  getSignalDeviceIdFn,
  signalDecryptFn,
  decryptV1MessageFn,
  fromBase64Fn = fromBase64,
  nowFn = () => Date.now(),
  parseJsonFn = JSON.parse,
  textDecoder = new TextDecoder(),
} = {}) {
  async function encryptDirectMessage(recipientUserId, textContent, attachmentMeta) {
    if (!isE2EInitializedFn?.()) throw new Error('E2E encryption not initialized');

    const payload = {
      body: textContent,
      attachments: attachmentMeta || [],
      ts: nowFn(),
    };

    const envelope = await buildDirectMessageEnvelopeFn?.(
      recipientUserId,
      JSON.stringify(payload)
    );
    return JSON.stringify(envelope);
  }

  async function decryptDirectMessage(senderUserId, envelopeJson) {
    if (!isE2EInitializedFn?.()) throw new Error('E2E encryption not initialized');

    const envelope = typeof envelopeJson === 'string'
      ? parseJsonFn(envelopeJson)
      : envelopeJson;

    if (Array.isArray(envelope?.copies) && envelope.copies.length > 0) {
      const currentUserId = getSignalUserIdFn?.();
      const currentDeviceId = getSignalDeviceIdFn?.();
      const matchingCopy = envelope.copies.find((copy) => (
        copy?.recipientUserId === currentUserId
        && Number(copy?.recipientDeviceId) === Number(currentDeviceId)
      ));

      if (!matchingCopy) {
        throw new Error(`No DM copy available for device ${currentDeviceId}`);
      }

      const plaintext = await signalDecryptFn?.(
        senderUserId,
        Number(envelope.senderDeviceId) || 1,
        matchingCopy.type,
        matchingCopy.payload
      );
      return parseJsonFn(plaintext);
    }

    if (envelope?.v === 2) {
      const plaintext = await signalDecryptFn?.(
        senderUserId,
        1,
        envelope.type,
        envelope.payload
      );
      return parseJsonFn(plaintext);
    }

    if (envelope?.v === 1) {
      return decryptLegacyDirectMessage(senderUserId, envelope);
    }

    throw new Error(`Unsupported protocol version: ${envelope?.v}`);
  }

  async function decryptLegacyDirectMessage(senderUserId, envelope) {
    if (!isV1StoreReadyFn?.()) {
      throw new Error('Cannot decrypt legacy message — v1 key store unavailable');
    }

    if (envelope.type !== 'x3dh_init' && envelope.type !== 'ratchet') {
      throw new Error(`Invalid v1 envelope type: ${envelope.type}`);
    }
    if (!envelope.rh || typeof envelope.rh.dh !== 'string'
      || !Number.isInteger(envelope.rh.pn) || !Number.isInteger(envelope.rh.n)) {
      throw new Error('Invalid v1 envelope: malformed ratchet header');
    }
    if (!envelope.ct || !envelope.nc) {
      throw new Error('Invalid v1 envelope: missing ciphertext or nonce');
    }
    if (envelope.type === 'x3dh_init' && !envelope.x3dh) {
      throw new Error('Invalid v1 envelope: x3dh_init without x3dh header');
    }

    const header = { dh: envelope.rh.dh, pn: envelope.rh.pn, n: envelope.rh.n };
    const ciphertext = fromBase64Fn(envelope.ct);
    const nonce = fromBase64Fn(envelope.nc);
    const x3dhHeader = envelope.type === 'x3dh_init' ? envelope.x3dh : null;

    const plaintext = await decryptV1MessageFn?.(
      senderUserId,
      header,
      ciphertext,
      nonce,
      x3dhHeader
    );
    const payload = parseJsonFn(textDecoder.decode(plaintext));

    return {
      body: payload.body,
      attachments: payload.attachments || [],
      ts: payload.ts,
    };
  }

  return {
    encryptDirectMessage,
    decryptDirectMessage,
  };
}
