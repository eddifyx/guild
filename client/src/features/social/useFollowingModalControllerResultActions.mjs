import { useFollowingModalControllerInviteActions } from './useFollowingModalControllerInviteActions.mjs';
import { useFollowingModalControllerRequestActions } from './useFollowingModalControllerRequestActions.mjs';
import { useFollowingModalControllerSearchActions } from './useFollowingModalControllerSearchActions.mjs';

export function useFollowingModalControllerResultActions({
  state = {},
  viewState = {},
} = {}) {
  const { clearSearchMessage, ...searchActions } = useFollowingModalControllerSearchActions({
    state,
  });
  const requestActions = useFollowingModalControllerRequestActions({
    state,
    clearSearchMessage,
  });
  const inviteActions = useFollowingModalControllerInviteActions({
    state,
    viewState,
    clearSearchMessage,
  });

  return {
    ...searchActions,
    ...requestActions,
    ...inviteActions,
  };
}
