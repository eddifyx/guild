import { useLoginScreenControllerAuthActions } from './useLoginScreenControllerAuthActions.mjs';
import { useLoginScreenControllerUiActions } from './useLoginScreenControllerUiActions.mjs';

export function useLoginScreenControllerActions({
  onLoginSuccess,
  auth = {},
  state = {},
} = {}) {
  const {
    authChallengeUrl = '',
    qrPhase = 'idle',
  } = state;

  const uiActions = useLoginScreenControllerUiActions({ state });
  const authActions = useLoginScreenControllerAuthActions({
    onLoginSuccess,
    auth,
    state,
    stopQrSession: uiActions.stopQrSession,
  });

  return {
    authChallengeUrl,
    qrPhase,
    ...uiActions,
    ...authActions,
  };
}
