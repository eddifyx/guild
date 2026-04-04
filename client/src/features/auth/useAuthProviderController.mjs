import { useAuthProviderControllerComposition } from './useAuthProviderControllerComposition.mjs';
import { useAuthProviderControllerState } from './useAuthProviderControllerState.mjs';

export function useAuthProviderController() {
  const state = useAuthProviderControllerState();
  return useAuthProviderControllerComposition({
    state,
  });
}
