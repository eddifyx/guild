import { useGuildChatDockControllerComposition } from './useGuildChatDockControllerComposition.mjs';
import { useGuildChatDockControllerState } from './useGuildChatDockControllerState.mjs';
import { useGuildChatDockControllerViewState } from './useGuildChatDockControllerViewState.mjs';

export function useGuildChatDockController({
  guildChat,
  hidden = false,
  currentGuildData = null,
  currentUserId = null,
} = {}) {
  const state = useGuildChatDockControllerState({ hidden });
  const viewState = useGuildChatDockControllerViewState({
    guildChat,
    currentGuildData,
    currentUserId,
    draft: state.draft,
    composerSelection: state.composerSelection,
    selectedMentionSuggestionIndex: state.selectedMentionSuggestionIndex,
    setSelectedMentionSuggestionIndex: state.setSelectedMentionSuggestionIndex,
    pendingFiles: state.pendingFiles,
    sending: state.sending,
  });
  const composition = useGuildChatDockControllerComposition({
    guildChat,
    hidden,
    state,
    viewState,
  });

  return {
    lastError: viewState.lastError,
    typingUsers: viewState.typingUsers,
    currentGuildData,
    draft: state.draft,
    pendingFiles: state.pendingFiles,
    localError: state.localError,
    canCompose: viewState.canCompose,
    composerDisabledReason: viewState.composerDisabledReason,
    canSend: viewState.canSend,
    dragActive: state.dragActive,
    liveEntries: viewState.liveEntries,
    mentionSuggestions: viewState.mentionSuggestions,
    selectedMentionSuggestionIndex: state.selectedMentionSuggestionIndex,
    feedRef: state.feedRef,
    inputRef: state.inputRef,
    currentUserId,
    ...composition,
  };
}
