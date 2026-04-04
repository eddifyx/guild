import { useFollowingModalControllerActions } from './useFollowingModalControllerActions.mjs';
import { useFollowingModalControllerViewState } from './useFollowingModalControllerViewState.mjs';

export function useFollowingModalControllerComposition({
  onClose,
  socket = null,
  state = {},
} = {}) {
  const viewState = useFollowingModalControllerViewState({
    tab: state.tab,
    contacts: state.contacts,
    profiles: state.profiles,
    selectedNpub: state.selectedNpub,
    incoming: state.incoming,
    query: state.query,
    searching: state.searching,
    searchResults: state.searchResults,
    searchMsg: state.searchMsg,
  });

  const actions = useFollowingModalControllerActions({
    onClose,
    socket,
    state,
    viewState,
  });

  return {
    viewState,
    actions,
  };
}
