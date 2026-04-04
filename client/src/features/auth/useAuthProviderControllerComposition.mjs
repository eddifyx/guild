import { useMemo } from 'react';

import { useAuthProviderControllerActions } from './useAuthProviderControllerActions.mjs';
import { useAuthProviderControllerSessionRuntime } from './useAuthProviderControllerSessionRuntime.mjs';

export function useAuthProviderControllerComposition({
  state = {},
} = {}) {
  const sessionRuntime = useAuthProviderControllerSessionRuntime({
    state,
  });
  const actions = useAuthProviderControllerActions({
    state,
    clearLocalSession: sessionRuntime.clearLocalSession,
    completeAuthenticatedLogin: sessionRuntime.completeAuthenticatedLogin,
  });

  return useMemo(() => ({
    user: sessionRuntime.user,
    cryptoStatus: sessionRuntime.cryptoStatus,
    cryptoError: sessionRuntime.cryptoError,
    mergeUser: sessionRuntime.mergeUser,
    syncNostrProfile: sessionRuntime.syncNostrProfile,
    retryCryptoInitialization: sessionRuntime.retryCryptoInitialization,
    nostrLogin: actions.nostrLogin,
    nostrConnectLogin: actions.nostrConnectLogin,
    nsecLogin: actions.nsecLogin,
    createAccount: actions.createAccount,
    logout: actions.logout,
  }), [
    actions.createAccount,
    actions.logout,
    actions.nostrConnectLogin,
    actions.nostrLogin,
    actions.nsecLogin,
    sessionRuntime.cryptoError,
    sessionRuntime.cryptoStatus,
    sessionRuntime.mergeUser,
    sessionRuntime.retryCryptoInitialization,
    sessionRuntime.syncNostrProfile,
    sessionRuntime.user,
  ]);
}
