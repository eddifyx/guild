import { useCallback } from 'react';

import { useAuthRuntimeEffects } from './authRuntimeEffects.mjs';
import {
  getAuthChallengeEventName,
  getLoginMode,
  getSigner,
  reconnect,
  waitForNip46RelayCooldown,
} from '../../utils/nostrConnect.js';
import { useAuthProviderControllerSecureSession } from './useAuthProviderControllerSecureSession.mjs';
import { useAuthProviderControllerSessionSupport } from './useAuthProviderControllerSessionSupport.mjs';

export function useAuthProviderControllerSessionRuntime({
  state = {},
} = {}) {
  const {
    secureStartupAttemptRef = { current: 0 },
    user = null,
    setUser = () => {},
    cryptoState = { status: 'idle', error: null },
    dispatchCryptoState = () => {},
  } = state;

  const cryptoStatus = cryptoState.status;
  const cryptoError = cryptoState.error;

  const support = useAuthProviderControllerSessionSupport({
    state: {
      secureStartupAttemptRef,
      user,
      setUser,
      dispatchCryptoState,
    },
  });
  const secureSession = useAuthProviderControllerSecureSession({
    state: {
      secureStartupAttemptRef,
      user,
      setUser,
      dispatchCryptoState,
    },
    support,
  });

  useAuthRuntimeEffects({
    user,
    clearLocalSession: support.clearLocalSession,
    initializeSecureSession: secureSession.initializeSecureSession,
    syncNostrProfile: support.syncNostrProfile,
    getAuthChallengeEventNameFn: getAuthChallengeEventName,
    getLoginModeFn: getLoginMode,
    getSignerFn: getSigner,
    reconnectSignerFn: reconnect,
    waitForNip46RelayCooldownFn: waitForNip46RelayCooldown,
  });

  return {
    user,
    cryptoStatus,
    cryptoError,
    mergeUser: support.mergeUser,
    syncNostrProfile: support.syncNostrProfile,
    clearLocalSession: support.clearLocalSession,
    retryCryptoInitialization: secureSession.retryCryptoInitialization,
    completeAuthenticatedLogin: secureSession.completeAuthenticatedLogin,
  };
}
