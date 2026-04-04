import { useCallback } from 'react';

import { initializeCryptoIdentity } from '../../crypto/sessionManager';
import {
  getSigner,
  reconnect,
} from '../../utils/nostrConnect';
import {
  pushNip46Trace,
  redactTraceValue,
  summarizeError,
} from '../../utils/nip46Trace';
import {
  finalizeAuthenticatedLogin,
} from './sessionLoginFlow.mjs';
import {
  ensureCompletedSecureLogin,
  initializeSecureSessionAttempt,
} from './secureSessionFlow.mjs';

export function useAuthProviderControllerSecureSession({
  state = {},
  support = {},
} = {}) {
  const {
    secureStartupAttemptRef = { current: 0 },
    user = null,
    setUser = () => {},
    dispatchCryptoState = () => {},
  } = state;

  const {
    stageSession = () => {},
  } = support;

  const initializeSecureSession = useCallback(async (authData, options = {}) => (
    initializeSecureSessionAttempt(authData, {
      attemptId: ++secureStartupAttemptRef.current,
      getCurrentAttemptId: () => secureStartupAttemptRef.current,
      shouldReconnect: options.reconnectSigner === true,
      reconnectSigner: reconnect,
      initializeCryptoIdentity,
      getSigner,
      dispatchCryptoState,
    })
  ), [dispatchCryptoState, secureStartupAttemptRef]);

  const retryCryptoInitialization = useCallback(async () => {
    if (!user) return false;
    const result = await initializeSecureSession(user, {
      reconnectSigner: true,
    });
    return result.ok;
  }, [initializeSecureSession, user]);

  const ensureSecureLogin = useCallback(async (authData) => (
    ensureCompletedSecureLogin(authData, {
      initializeSecureSession,
      dispatchCryptoState,
      pushTrace: pushNip46Trace,
      redactTraceValue,
      summarizeError,
    })
  ), [dispatchCryptoState, initializeSecureSession]);

  const completeAuthenticatedLogin = useCallback(async (authData) => (
    finalizeAuthenticatedLogin(authData, {
      stageSession,
      ensureSecureLogin,
      setUser,
    })
  ), [ensureSecureLogin, setUser, stageSession]);

  return {
    initializeSecureSession,
    retryCryptoInitialization,
    ensureSecureLogin,
    completeAuthenticatedLogin,
  };
}
