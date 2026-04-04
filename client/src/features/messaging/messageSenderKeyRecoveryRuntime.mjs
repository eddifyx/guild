export async function recoverRoomMessageAfterSenderKeyMiss({
  message,
  roomId = message?.room_id,
  senderUserId = message?.sender_id,
  windowObj,
  decryptRoomMessageFn,
  flushPendingControlMessagesNowFn,
  syncRoomSenderKeysFn,
  requestRoomSenderKeyFn,
  waitForSenderKeyUpdateFn,
} = {}) {
  let lastError = null;

  try {
    await flushPendingControlMessagesNowFn?.();
    await syncRoomSenderKeysFn?.(roomId);
    await flushPendingControlMessagesNowFn?.();
    return {
      result: await decryptRoomMessageFn?.(),
      lastError: null,
    };
  } catch (retryError) {
    lastError = retryError;

    const senderKeyArrived = await waitForSenderKeyUpdateFn?.({
      roomId,
      windowObj,
    });
    const recoveredFromStorage = senderKeyArrived
      ? false
      : ((await syncRoomSenderKeysFn?.(roomId)) || 0) > 0;
    const recoveredFromDeliveredHistory = (senderKeyArrived || recoveredFromStorage)
      ? false
      : (((await syncRoomSenderKeysFn?.(roomId, { includeDelivered: true, limit: 64 })) || 0) > 0);

    if (senderKeyArrived || recoveredFromStorage || recoveredFromDeliveredHistory) {
      try {
        await flushPendingControlMessagesNowFn?.();
        return {
          result: await decryptRoomMessageFn?.(),
          lastError: null,
        };
      } catch (finalError) {
        lastError = finalError;
      }
    } else {
      const requestedResend = await requestRoomSenderKeyFn?.(roomId, senderUserId);
      if (requestedResend) {
        const resentKeyArrived = await waitForSenderKeyUpdateFn?.({
          roomId,
          windowObj,
        });
        const resentRecoveredFromStorage = resentKeyArrived
          ? false
          : ((await syncRoomSenderKeysFn?.(roomId)) || 0) > 0;

        if (resentKeyArrived || resentRecoveredFromStorage) {
          try {
            await flushPendingControlMessagesNowFn?.();
            return {
              result: await decryptRoomMessageFn?.(),
              lastError: null,
            };
          } catch (finalError) {
            lastError = finalError;
          }
        }
      }
    }
  }

  return {
    result: null,
    lastError,
  };
}
