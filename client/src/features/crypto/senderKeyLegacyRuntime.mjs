export function createSenderKeyLegacyRuntime({
  getKeyStoreFn,
  isV1StoreReadyFn,
  apiRequestFn,
  validateLegacySenderKeyPayloadFn,
  fromBase64Fn,
  toBase64Fn,
  concatBytesFn,
  ed25519VerifyFn,
  aes256GcmDecryptFn,
  hmacSha256Fn,
  maxIteration,
  maxSenderKeySkip,
} = {}) {
  const textEncoder = new TextEncoder();
  const textDecoder = new TextDecoder();

  async function verifyLegacyRoomMembership(roomId, fromUserId) {
    try {
      const members = await apiRequestFn?.(`/api/rooms/${roomId}/members`);
      if (!members?.some((member) => member.id === fromUserId)) {
        throw new Error(`V1 SKDM: ${fromUserId} not a member of room ${roomId}`);
      }
    } catch (memberErr) {
      if (memberErr?.message?.includes('not a member')) throw memberErr;
      throw new Error(`V1 SKDM: could not verify room membership for ${fromUserId}`);
    }
  }

  async function processLegacySenderKey(fromUserId, payload) {
    if (!isV1StoreReadyFn?.()) throw new Error('V1 key store not available');

    const { chainKeyBytes, signingKeyBytes } = validateLegacySenderKeyPayloadFn?.({
      payload,
      fromBase64Fn,
      maxIteration,
    }) || {};

    try {
      if (payload?.roomId) {
        await verifyLegacyRoomMembership(payload.roomId, fromUserId);
      }
    } finally {
      chainKeyBytes?.fill(0);
      signingKeyBytes?.fill(0);
    }

    const keyStore = getKeyStoreFn?.();
    const existingKey = await keyStore?.getSenderKey(payload.roomId, payload.senderUserId);
    if (existingKey && payload.iteration <= existingKey.iteration) {
      throw new Error(`V1 SKDM: rollback rejected (${payload.iteration} <= ${existingKey.iteration})`);
    }

    await keyStore?.saveSenderKey(payload.roomId, payload.senderUserId, {
      chainKey: payload.chainKey,
      signingKeyPublic: payload.signingKeyPublic,
      iteration: payload.iteration,
    });
  }

  async function decryptLegacySenderKey(roomId, senderUserId, envelope) {
    if (!isV1StoreReadyFn?.()) {
      throw new Error('Cannot decrypt legacy group message — v1 key store unavailable');
    }

    if (envelope?.type !== 'sender_key') throw new Error('Invalid v1 sender key envelope');
    if (envelope.skid !== senderUserId) {
      throw new Error(`V1 SK: sender mismatch ${envelope.skid} vs ${senderUserId}`);
    }

    const keyStore = getKeyStoreFn?.();
    const senderKey = await keyStore?.getSenderKey(roomId, envelope.skid);
    if (!senderKey) throw new Error(`No v1 sender key for ${envelope.skid} in room ${roomId}`);

    const ctBytes = fromBase64Fn(envelope.ct);
    const ncBytes = fromBase64Fn(envelope.nc);
    const sigBytes = fromBase64Fn(envelope.sig);
    const sigPub = fromBase64Fn(senderKey.signingKeyPublic);

    if (!ed25519VerifyFn(sigPub, concatBytesFn(ncBytes, ctBytes), sigBytes)) {
      throw new Error('V1 SK: Invalid signature');
    }

    const iteration = envelope.iter;
    if (!Number.isInteger(iteration) || iteration < 0 || iteration > maxIteration) {
      throw new Error('V1 SK: Invalid iteration');
    }

    const aad = textEncoder.encode(JSON.stringify({ roomId, senderId: senderUserId }));

    if (!senderKey.skippedKeys) senderKey.skippedKeys = {};

    const skipKey = String(iteration);
    if (senderKey.skippedKeys[skipKey]) {
      const messageKey = fromBase64Fn(senderKey.skippedKeys[skipKey]);
      const plaintext = aes256GcmDecryptFn(messageKey, ctBytes, ncBytes, aad);
      delete senderKey.skippedKeys[skipKey];
      messageKey.fill(0);
      await keyStore?.saveSenderKey(roomId, envelope.skid, senderKey);
      const payload = JSON.parse(textDecoder.decode(plaintext));
      return { body: payload.body, attachments: payload.attachments || [], ts: payload.ts };
    }

    const targetIter = iteration + 1;
    const gap = targetIter - senderKey.iteration;
    if (gap > maxSenderKeySkip) throw new Error(`V1 SK: gap ${gap} exceeds max`);
    if (gap < 1) throw new Error('V1 SK: iteration already consumed');

    const savedChainKey = senderKey.chainKey;
    const savedIteration = senderKey.iteration;
    const savedSkipped = { ...senderKey.skippedKeys };

    try {
      let chainKey = fromBase64Fn(senderKey.chainKey);
      for (let index = senderKey.iteration; index <= iteration; index += 1) {
        const advanced = hmacSha256Fn(chainKey, new Uint8Array([0x01]));
        chainKey.fill(0);
        if (index < iteration) {
          const skippedMessageKey = hmacSha256Fn(advanced, new Uint8Array([0x02]));
          senderKey.skippedKeys[String(index)] = toBase64Fn(skippedMessageKey);
          skippedMessageKey.fill(0);
          chainKey = hmacSha256Fn(advanced, new Uint8Array([0x01]));
          advanced.fill(0);
        } else {
          chainKey = advanced;
        }
      }

      const messageKey = hmacSha256Fn(chainKey, new Uint8Array([0x02]));
      const newChainKey = hmacSha256Fn(chainKey, new Uint8Array([0x01]));
      const plaintext = aes256GcmDecryptFn(messageKey, ctBytes, ncBytes, aad);

      senderKey.chainKey = toBase64Fn(newChainKey);
      senderKey.iteration = iteration + 1;
      messageKey.fill(0);

      const skippedEntries = Object.keys(senderKey.skippedKeys);
      if (skippedEntries.length > maxSenderKeySkip) {
        for (let index = 0; index < skippedEntries.length - maxSenderKeySkip; index += 1) {
          delete senderKey.skippedKeys[skippedEntries[index]];
        }
      }

      await keyStore?.saveSenderKey(roomId, envelope.skid, senderKey);
      const payload = JSON.parse(textDecoder.decode(plaintext));
      return { body: payload.body, attachments: payload.attachments || [], ts: payload.ts };
    } catch (err) {
      senderKey.chainKey = savedChainKey;
      senderKey.iteration = savedIteration;
      senderKey.skippedKeys = savedSkipped;
      throw err;
    }
  }

  return {
    processLegacySenderKey,
    decryptLegacySenderKey,
  };
}
