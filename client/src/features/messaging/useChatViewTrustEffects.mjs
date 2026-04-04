import { useEffect } from 'react';

import { loadRemoteIdentityVerification } from '../../crypto/signalClient.js';
import { isE2EInitialized } from '../../crypto/sessionManager';
import { buildChatViewIdentityVerificationInput } from './chatViewRuntimeInputs.mjs';
import { shouldLoadChatViewIdentityVerification } from './chatViewRuntimeModel.mjs';

export function useChatViewTrustEffects({
  effectiveConversation = null,
  trustBootstrapState = {},
  setKeyChangedFn = () => {},
  setIdentityCheckErrorFn = () => {},
  setTrustedNpubFn = () => {},
  setTrustInputFn = () => {},
  setTrustErrorFn = () => {},
  setShowVerifyModalFn = () => {},
  getKnownNpubFn = () => null,
  isE2EInitializedFn = isE2EInitialized,
  loadRemoteIdentityVerificationFn = loadRemoteIdentityVerification,
} = {}) {
  useEffect(() => {
    setKeyChangedFn(trustBootstrapState.keyChanged);
    setIdentityCheckErrorFn(trustBootstrapState.identityCheckError);
    setTrustedNpubFn(trustBootstrapState.trustedNpub);
    setTrustInputFn(trustBootstrapState.trustInput);
    setTrustErrorFn(trustBootstrapState.trustError);

    if (!shouldLoadChatViewIdentityVerification(buildChatViewIdentityVerificationInput({
      effectiveConversation,
      trustedNpub: trustBootstrapState.trustedNpub,
      isE2EInitializedFn,
    }))) return;

    let cancelled = false;
    (async () => {
      try {
        const { trustState } = await loadRemoteIdentityVerificationFn(effectiveConversation.id);
        if (cancelled) return;
        setKeyChangedFn(trustState?.status === 'key_changed');
        setIdentityCheckErrorFn('');
      } catch (err) {
        if (cancelled) return;
        setKeyChangedFn(false);
        setIdentityCheckErrorFn(err?.message || 'Unable to confirm this contact\'s current identity.');
      }
    })();
    return () => { cancelled = true; };
  }, [
    effectiveConversation,
    isE2EInitializedFn,
    loadRemoteIdentityVerificationFn,
    setIdentityCheckErrorFn,
    setKeyChangedFn,
    setTrustedNpubFn,
    setTrustErrorFn,
    setTrustInputFn,
    trustBootstrapState,
  ]);

  useEffect(() => {
    if (!effectiveConversation || effectiveConversation.type !== 'dm' || effectiveConversation.dmUnsupported) return;
    const handleTrustUpdate = (event) => {
      if (event.detail?.userId !== effectiveConversation.id) return;
      setTrustedNpubFn(event.detail.npub || getKnownNpubFn(effectiveConversation.id));
      setTrustErrorFn('');
      setIdentityCheckErrorFn('');
    };
    const handleIdentityVerified = (event) => {
      if (event.detail?.userId !== effectiveConversation.id) return;
      setKeyChangedFn(false);
      setIdentityCheckErrorFn('');
      setShowVerifyModalFn(false);
    };
    window.addEventListener('trusted-npub-updated', handleTrustUpdate);
    window.addEventListener('identity-verified', handleIdentityVerified);
    return () => {
      window.removeEventListener('trusted-npub-updated', handleTrustUpdate);
      window.removeEventListener('identity-verified', handleIdentityVerified);
    };
  }, [
    effectiveConversation,
    getKnownNpubFn,
    setIdentityCheckErrorFn,
    setKeyChangedFn,
    setShowVerifyModalFn,
    setTrustedNpubFn,
    setTrustErrorFn,
  ]);
}
