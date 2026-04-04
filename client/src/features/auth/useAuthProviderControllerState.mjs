import { useReducer, useRef, useState } from 'react';

import { getSigner } from '../../utils/nostrConnect';
import {
  pushNip46Trace,
  redactTraceValue,
} from '../../utils/nip46Trace';
import { loadRecoverableStoredAuth } from '../../utils/authStorage';
import {
  createSecureStartupState,
  reduceSecureStartupState,
} from './secureStartupState.mjs';
import { restoreInitialSessionUser } from './authSessionFlow.mjs';

export const INITIAL_AUTH_UNSET = Symbol('initial-auth-unset');

export function initializeAuthProviderInitialUser({
  initialUserRef,
  restoreInitialSessionUserFn = restoreInitialSessionUser,
  loadStoredAuthFn = loadRecoverableStoredAuth,
  pushTraceFn = pushNip46Trace,
  redactTraceValueFn = redactTraceValue,
  getSignerFn = getSigner,
} = {}) {
  if (initialUserRef.current === INITIAL_AUTH_UNSET) {
    initialUserRef.current = restoreInitialSessionUserFn({
      loadStoredAuth: loadStoredAuthFn,
      pushTrace: pushTraceFn,
      redactTraceValue: redactTraceValueFn,
      getSigner: getSignerFn,
    });
  }

  return initialUserRef.current;
}

export function useAuthProviderControllerState() {
  const secureStartupAttemptRef = useRef(0);
  const initialUserRef = useRef(INITIAL_AUTH_UNSET);
  const initialUser = initializeAuthProviderInitialUser({ initialUserRef });

  const [user, setUser] = useState(() => initialUser);
  const [cryptoState, dispatchCryptoState] = useReducer(
    reduceSecureStartupState,
    { hasStoredAuth: Boolean(initialUser) },
    createSecureStartupState,
  );

  return {
    secureStartupAttemptRef,
    user,
    setUser,
    cryptoState,
    dispatchCryptoState,
  };
}
