import { useFollowingModalControllerEffects } from './useFollowingModalControllerEffects.mjs';
import { useFollowingModalControllerResultActions } from './useFollowingModalControllerResultActions.mjs';

export function useFollowingModalControllerActions({
  onClose,
  socket = null,
  state = {},
  viewState = {},
} = {}) {
  useFollowingModalControllerEffects({
    onClose,
    socket,
    state,
  });

  return useFollowingModalControllerResultActions({
    state,
    viewState,
  });
}
