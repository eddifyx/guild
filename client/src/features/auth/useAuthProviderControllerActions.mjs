import { useCallback, useMemo } from 'react';

import { api } from '../../api';
import { publishProfile, uploadImage } from '../../nostr/profilePublisher';
import {
  activateNsec,
  connectWithBunkerURI,
  decodeNsec,
  getSigner,
} from '../../utils/nostrConnect';
import { persistRecoverableAuth } from '../../utils/authStorage';
import {
  pushNip46Trace,
  redactTraceValue,
  summarizeError,
} from '../../utils/nip46Trace';
import { logoutSession } from './authSessionFlow.mjs';
import { authenticateWithServer } from './nostrLoginFlow.mjs';
import { createAuthActions } from './authActionFlow.mjs';
import { finalizeCreatedAccountProfile } from './sessionProfileFlow.mjs';

export function useAuthProviderControllerActions({
  state = {},
  clearLocalSession = async () => {},
  completeAuthenticatedLogin = async () => null,
} = {}) {
  const {
    setUser = () => {},
  } = state;

  const {
    nostrLogin,
    nostrConnectLogin,
    nsecLogin,
    createAccount,
  } = useMemo(() => createAuthActions({
    connectWithBunkerURI,
    decodeNsec,
    activateNsec,
    getSigner,
    authenticateWithServer,
    completeAuthenticatedLogin,
    finalizeCreatedAccountProfile,
    uploadImage,
    publishProfile,
    apiRequest: api,
    persistAuth: persistRecoverableAuth,
    setUser,
    clearLocalSession,
    pushTrace: pushNip46Trace,
    redactTraceValue,
    summarizeError,
  }), [
    clearLocalSession,
    completeAuthenticatedLogin,
    setUser,
  ]);

  const logout = useCallback(async () => (
    logoutSession({
      apiRequest: api,
      clearLocalSession,
    })
  ), [clearLocalSession]);

  return {
    nostrLogin,
    nostrConnectLogin,
    nsecLogin,
    createAccount,
    logout,
  };
}
