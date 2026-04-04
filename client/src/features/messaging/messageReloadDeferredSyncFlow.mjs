export const DEFERRED_ROOM_SENDER_KEY_SYNC_DELAY_MS = 3000;

export function scheduleDeferredRoomSenderKeySync({
  conversation,
  conversationKey,
  perfTraceId = null,
  reloadStartedAt = 0,
  roomSenderKeySyncPromise = null,
  isConversationActiveFn = () => true,
  debugRoomOpenLogFn = () => {},
  addPerfPhaseFn = () => {},
  syncConversationRoomSenderKeysFn = async () => {},
  retryFailedVisibleRoomMessagesFn = async () => {},
  setDeferredRoomSenderKeySyncHandleFn = () => {},
  setTimeoutFn = setTimeout,
  nowFn = () => Date.now(),
  warnFn = () => {},
} = {}) {
  const useFastRoomOpen = conversation?.type === 'room';
  if (useFastRoomOpen && conversation?.type === 'room') {
    debugRoomOpenLogFn('sender-key-sync-scheduled', {
      roomId: conversation.id,
      sinceReloadStartMs: nowFn() - reloadStartedAt,
      delayMs: DEFERRED_ROOM_SENDER_KEY_SYNC_DELAY_MS,
    });

    const timeoutHandle = setTimeoutFn(() => {
      setDeferredRoomSenderKeySyncHandleFn(null);

      if (!isConversationActiveFn(conversationKey)) {
        debugRoomOpenLogFn('sender-key-sync-skipped', {
          roomId: conversation.id,
          sinceReloadStartMs: nowFn() - reloadStartedAt,
          reason: 'conversation-changed',
        });
        return;
      }

      debugRoomOpenLogFn('sender-key-sync-start', {
        roomId: conversation.id,
        sinceReloadStartMs: nowFn() - reloadStartedAt,
      });

      void syncConversationRoomSenderKeysFn(conversation.id)
        .catch((err) => {
          warnFn('[Rooms] Deferred sender-key sync failed while opening room:', err?.message || err);
          debugRoomOpenLogFn('sender-key-sync-error', {
            roomId: conversation.id,
            sinceReloadStartMs: nowFn() - reloadStartedAt,
            error: err?.message || String(err || 'unknown'),
          });
        })
        .finally(() => {
          debugRoomOpenLogFn('sender-key-sync-finished', {
            roomId: conversation.id,
            sinceReloadStartMs: nowFn() - reloadStartedAt,
          });
          addPerfPhaseFn(perfTraceId, 'messages:sender-key-sync-finished');
          if (isConversationActiveFn(conversationKey)) {
            void retryFailedVisibleRoomMessagesFn({ allowRoomSenderKeyRecovery: false });
          }
        });
    }, DEFERRED_ROOM_SENDER_KEY_SYNC_DELAY_MS);

    setDeferredRoomSenderKeySyncHandleFn(timeoutHandle);
  } else if (roomSenderKeySyncPromise) {
    void roomSenderKeySyncPromise.finally(() => {
      addPerfPhaseFn(perfTraceId, 'messages:sender-key-sync-finished');
    });
  }
}
