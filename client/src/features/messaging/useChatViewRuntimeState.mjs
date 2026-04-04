import { useRef, useState } from 'react';

export function useChatViewRuntimeState({
  trustBootstrapState,
} = {}) {
  const [keyChanged, setKeyChanged] = useState(trustBootstrapState.keyChanged);
  const [identityCheckError, setIdentityCheckError] = useState(trustBootstrapState.identityCheckError);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [trustedNpub, setTrustedNpub] = useState(trustBootstrapState.trustedNpub);
  const [trustInput, setTrustInput] = useState(trustBootstrapState.trustInput);
  const [trustError, setTrustError] = useState(trustBootstrapState.trustError);
  const [trustSaving, setTrustSaving] = useState(false);

  const bottomRef = useRef(null);
  const scrollRef = useRef(null);
  const messagesContentRef = useRef(null);
  const wasAtBottomRef = useRef(true);
  const scrollingRef = useRef(false);
  const pendingOlderLoadIdRef = useRef(0);
  const loadingOlderRef = useRef(false);
  const pendingInitialScrollRef = useRef(false);
  const initialScrollReleaseTimerRef = useRef(null);
  const initialScrollPinnedUntilRef = useRef(0);
  const completedOpenTraceIdsRef = useRef(new Set());

  return {
    keyChanged,
    setKeyChanged,
    identityCheckError,
    setIdentityCheckError,
    showVerifyModal,
    setShowVerifyModal,
    trustedNpub,
    setTrustedNpub,
    trustInput,
    setTrustInput,
    trustError,
    setTrustError,
    trustSaving,
    setTrustSaving,
    bottomRef,
    scrollRef,
    messagesContentRef,
    wasAtBottomRef,
    scrollingRef,
    pendingOlderLoadIdRef,
    loadingOlderRef,
    pendingInitialScrollRef,
    initialScrollReleaseTimerRef,
    initialScrollPinnedUntilRef,
    completedOpenTraceIdsRef,
  };
}
