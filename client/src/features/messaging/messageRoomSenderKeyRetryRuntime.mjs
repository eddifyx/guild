import { E2E_INIT_READY_EVENT } from '../auth/secureSessionFlow.mjs';

export function bindRoomSenderKeyRetry({
  conversation,
  retryFailedVisibleRoomMessagesFn,
  windowObj,
} = {}) {
  if (!conversation || conversation.type !== 'room') return () => {};
  if (!windowObj?.addEventListener || !windowObj?.removeEventListener) return () => {};

  const handleSenderKeyUpdated = (event) => {
    if (event?.detail?.roomId !== conversation.id) return;
    retryFailedVisibleRoomMessagesFn?.({ allowRoomSenderKeyRecovery: false });
  };

  const handleSecureReady = () => {
    retryFailedVisibleRoomMessagesFn?.();
  };

  windowObj.addEventListener('sender-key-updated', handleSenderKeyUpdated);
  windowObj.addEventListener(E2E_INIT_READY_EVENT, handleSecureReady);

  return () => {
    windowObj.removeEventListener('sender-key-updated', handleSenderKeyUpdated);
    windowObj.removeEventListener(E2E_INIT_READY_EVENT, handleSecureReady);
  };
}
