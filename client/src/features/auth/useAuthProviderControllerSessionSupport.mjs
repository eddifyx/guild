import { useCallback } from 'react';

import { api, resetSessionExpiry } from '../../api';
import { clearPersistedSignalLocalState, destroyCryptoState } from '../../crypto/sessionManager';
import {
  disconnect as disconnectSigner,
} from '../../utils/nostrConnect';
import {
  clearRecoverableAuth,
  persistRecoverableAuth,
} from '../../utils/authStorage';
import { mergeSessionUser } from './sessionUserState.mjs';
import {
  applyMergedSessionUser,
  clearLocalSessionState,
} from './authSessionFlow.mjs';
import { loadProfileForLogin } from './nostrLoginFlow.mjs';
import {
  stageAuthenticatedSession,
} from './sessionLoginFlow.mjs';
import { syncSessionNostrProfile } from './sessionProfileFlow.mjs';

export function useAuthProviderControllerSessionSupport({
  state = {},
} = {}) {
  const {
    secureStartupAttemptRef = { current: 0 },
    user = null,
    setUser = () => {},
    dispatchCryptoState = () => {},
  } = state;

  const mergeUser = useCallback((updates) => {
    setUser((current) => applyMergedSessionUser({
      currentUser: current,
      updates,
      mergeSessionUser,
      persistAuth: persistRecoverableAuth,
    }));
  }, [setUser]);

  const stageSession = useCallback((authData) => stageAuthenticatedSession(authData, {
    persistAuth: persistRecoverableAuth,
    resetSessionExpiry,
  }), []);

  const syncNostrProfile = useCallback(async (profileOverride = null) => {
    const result = await syncSessionNostrProfile({
      user,
      profileOverride,
      loadProfile: loadProfileForLogin,
      apiRequest: api,
    });
    if (result?.syncedPatch) {
      mergeUser(result.syncedPatch);
    }
    if (!result) return null;
    return {
      profile: result.profile,
      syncedUser: result.syncedUser,
    };
  }, [mergeUser, user?.npub, user?.token, user?.username]);

  const clearLocalSession = useCallback(async () => (
    clearLocalSessionState({
      secureStartupAttemptRef,
      destroyCryptoState,
      resetLocalSignalState: clearPersistedSignalLocalState,
      currentUser: user,
      disconnectSigner,
      clearRecoverableAuth,
      setUser,
      dispatchCryptoState,
    })
  ), [dispatchCryptoState, secureStartupAttemptRef, setUser, user]);

  return {
    mergeUser,
    stageSession,
    syncNostrProfile,
    clearLocalSession,
  };
}
