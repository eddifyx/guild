import { useFollowingModalControllerComposition } from './useFollowingModalControllerComposition.mjs';
import { useFollowingModalControllerState } from './useFollowingModalControllerState.mjs';

export function useFollowingModalController({
  onClose,
  socket = null,
} = {}) {
  const state = useFollowingModalControllerState();
  const { viewState, actions } = useFollowingModalControllerComposition({
    onClose,
    socket,
    state,
  });

  return {
    tab: state.tab,
    setTab: state.setTab,
    tabs: viewState.tabs,
    query: state.query,
    searchMsg: state.searchMsg,
    searchMessageTone: viewState.searchMessageTone,
    searchRows: viewState.searchRows,
    searchViewState: viewState.searchViewState,
    loadingFriends: state.loadingFriends,
    friendRows: viewState.friendRows,
    copied: state.copied,
    loadingRequests: state.loadingRequests,
    incomingRows: viewState.incomingRows,
    actioningId: state.actioningId,
    ...actions,
  };
}
