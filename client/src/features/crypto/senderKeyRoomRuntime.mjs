export function createSenderKeyRoomRuntime({
  getCurrentUserIdFn,
  createSKDMFn,
  processSKDMFn,
  groupEncryptFn,
  groupDecryptFn,
  rekeyRoomFn,
  encryptDirectMessageFn,
  apiRequestFn,
  getSocketFn,
  rememberUsersFn,
  buildSenderKeyDistributionPayloadFn,
  emitSenderKeyDistributionWarningFn,
  emitSenderKeyEnvelopeFn,
  runWithConcurrencyFn,
  selectSenderKeyRecipientsFn,
  summarizeSenderKeyDistributionResultsFn,
  distributionConcurrency = 4,
  deliveryTimeoutMs = 5_000,
  nowFn = () => Date.now(),
  setTimeoutFn = globalThis.setTimeout?.bind(globalThis),
  clearTimeoutFn = globalThis.clearTimeout?.bind(globalThis),
  errorFn = console.error,
  warnFn = console.warn,
} = {}) {
  const distributedRooms = new Set();

  const emitEnvelope = emitSenderKeyEnvelopeFn || ((socket, payload) => new Promise((resolve, reject) => {
    if (!socket?.emit) {
      reject(new Error('Sender key delivery socket unavailable.'));
      return;
    }
    if (socket.connected === false) {
      reject(new Error('Sender key delivery socket is disconnected.'));
      return;
    }

    let settled = false;
    const timeoutId = setTimeoutFn?.(() => {
      if (settled) return;
      settled = true;
      reject(new Error('Sender key delivery timed out.'));
    }, deliveryTimeoutMs);

    socket.emit('dm:sender_key', payload, (response) => {
      if (settled) return;
      settled = true;
      if (timeoutId) clearTimeoutFn?.(timeoutId);
      if (response?.ok) {
        resolve(response);
        return;
      }
      reject(new Error(response?.error || 'Sender key delivery was rejected by the server.'));
    });
  }));

  async function distributeSKDM(roomId, skdmBase64, distributionId) {
    const myUserId = getCurrentUserIdFn?.();

    try {
      const members = await apiRequestFn?.(`/api/rooms/${roomId}/members`);
      rememberUsersFn?.(members);

      const recipients = selectSenderKeyRecipientsFn?.(members, myUserId) || [];
      const payload = buildSenderKeyDistributionPayloadFn?.({
        roomId,
        senderUserId: myUserId,
        skdmBase64,
      });
      const socket = getSocketFn?.();

      const results = await runWithConcurrencyFn?.(
        recipients,
        distributionConcurrency,
        async (member) => {
          try {
            const envelope = await encryptDirectMessageFn?.(member.id, payload);
            await emitEnvelope(socket, {
              toUserId: member.id,
              envelope,
              roomId,
              distributionId,
            });
            return { ok: true, member };
          } catch (err) {
            errorFn?.(`[SK] Failed to distribute SKDM to ${member.id}:`, err);
            return { ok: false, member, err };
          }
        },
      );

      const { deliveredCount, failures } = summarizeSenderKeyDistributionResultsFn?.(results) || {
        deliveredCount: 0,
        failures: [],
      };
      const recipientCount = recipients.length;

      if (failures.length > 0) {
        warnFn?.(
          `[SK] Room ${roomId} sender key reached ${deliveredCount}/${recipientCount} recipients; pending for: ${failures.join(', ')}`,
        );
        emitSenderKeyDistributionWarningFn?.({
          roomId,
          deliveredCount,
          recipientCount,
          failures,
        });
      }

      return {
        deliveredCount,
        recipientCount,
        failures,
      };
    } catch (err) {
      errorFn?.('[SK] Failed to distribute room sender key:', err);
      throw err;
    }
  }

  async function encryptWithSenderKey(roomId, textContent, attachmentMeta) {
    if (!distributedRooms.has(roomId)) {
      const { skdm, distributionId } = await createSKDMFn?.(roomId);
      const distributionResult = await distributeSKDM(roomId, skdm, distributionId);
      if ((distributionResult?.deliveredCount || 0) > 0 || (distributionResult?.recipientCount || 0) === 0) {
        distributedRooms.add(roomId);
      }
    }

    const payload = JSON.stringify({
      body: textContent,
      attachments: attachmentMeta || [],
      ts: nowFn(),
    });

    const ciphertext = await groupEncryptFn?.(roomId, payload);
    return JSON.stringify({
      v: 2,
      type: 7,
      payload: ciphertext,
    });
  }

  async function decryptRoomSenderKey(roomId, senderUserId, envelope) {
    const plaintext = await groupDecryptFn?.(senderUserId, roomId, envelope?.payload);
    return JSON.parse(plaintext);
  }

  async function processSenderKeyDistribution(fromUserId, payload) {
    if (payload?.roomId) {
      try {
        const members = await apiRequestFn?.(`/api/rooms/${payload.roomId}/members`);
        rememberUsersFn?.(members);
        if (!members?.some((member) => member.id === fromUserId)) {
          throw new Error(`SKDM: ${fromUserId} is not a member of room ${payload.roomId}`);
        }
      } catch (memberErr) {
        if (memberErr?.message?.includes('not a member')) throw memberErr;
        throw new Error(`SKDM: could not verify room membership for ${fromUserId}`);
      }
    }

    await processSKDMFn?.(fromUserId, payload?.skdm);
  }

  async function rekeyRoom(roomId) {
    const { skdm, distributionId } = await rekeyRoomFn?.(roomId);
    distributedRooms.delete(roomId);
    const distributionResult = await distributeSKDM(roomId, skdm, distributionId);
    if ((distributionResult?.deliveredCount || 0) > 0 || (distributionResult?.recipientCount || 0) === 0) {
      distributedRooms.add(roomId);
    }
  }

  async function redistributeSenderKey(roomId) {
    const { skdm, distributionId } = await createSKDMFn?.(roomId);
    await distributeSKDM(roomId, skdm, distributionId);
  }

  function getStateSnapshot() {
    return {
      distributedRooms: Array.from(distributedRooms),
    };
  }

  return {
    encryptWithSenderKey,
    decryptRoomSenderKey,
    processSenderKeyDistribution,
    rekeyRoom,
    redistributeSenderKey,
    getStateSnapshot,
  };
}
