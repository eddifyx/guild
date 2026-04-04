import { useLoginScreenControllerActions } from './useLoginScreenControllerActions.mjs';
import { useLoginScreenControllerEffects } from './useLoginScreenControllerEffects.mjs';

export function useLoginScreenControllerComposition({
  onLoginSuccess,
  auth = {},
  state = {},
} = {}) {
  useLoginScreenControllerEffects({
    onLoginSuccess,
    auth,
    state,
  });

  const actions = useLoginScreenControllerActions({
    onLoginSuccess,
    auth,
    state,
  });

  return {
    error: state.error,
    loading: state.loading,
    ...actions,
  };
}
