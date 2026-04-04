import { E2E_INIT_READY_EVENT } from '../auth/secureSessionFlow.mjs';
import { SIGNAL_SESSION_READY_EVENT } from '../crypto/signalSessionRuntime.mjs';

export function bindDMDecryptRetry({
  conversation,
  retryFailedVisibleMessagesFn,
  windowObj,
} = {}) {
  if (!conversation || conversation.type !== 'dm') return () => {};
  if (!windowObj?.addEventListener || !windowObj?.removeEventListener) return () => {};

  const handleTrustUpdate = (event) => {
    if (event?.detail?.userId !== conversation.id) return;
    retryFailedVisibleMessagesFn?.();
  };

  const handleIdentityVerified = (event) => {
    if (event?.detail?.userId !== conversation.id) return;
    retryFailedVisibleMessagesFn?.();
  };

  const handleSecureReady = () => {
    retryFailedVisibleMessagesFn?.();
  };

  const handleSignalSessionReady = (event) => {
    if (event?.detail?.userId !== conversation.id) return;
    retryFailedVisibleMessagesFn?.();
  };

  windowObj.addEventListener('trusted-npub-updated', handleTrustUpdate);
  windowObj.addEventListener('identity-verified', handleIdentityVerified);
  windowObj.addEventListener(E2E_INIT_READY_EVENT, handleSecureReady);
  windowObj.addEventListener(SIGNAL_SESSION_READY_EVENT, handleSignalSessionReady);

  return () => {
    windowObj.removeEventListener('trusted-npub-updated', handleTrustUpdate);
    windowObj.removeEventListener('identity-verified', handleIdentityVerified);
    windowObj.removeEventListener(E2E_INIT_READY_EVENT, handleSecureReady);
    windowObj.removeEventListener(SIGNAL_SESSION_READY_EVENT, handleSignalSessionReady);
  };
}
