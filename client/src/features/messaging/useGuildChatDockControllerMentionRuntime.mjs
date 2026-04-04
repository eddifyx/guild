import { useCallback } from 'react';

import {
  applyGuildChatMentionSelection,
  handleGuildChatComposerKeyEvent,
} from './guildChatComposerFlow.mjs';
import {
  buildGuildChatComposerKeyOptions,
  buildGuildChatMentionSelectionOptions,
} from './guildChatDockControllerBindings.mjs';

export function useGuildChatDockControllerMentionRuntime({
  state = {},
  refs = {},
  mentionState = {},
  handleSend = async () => {},
} = {}) {
  const {
    draft = '',
    setDraftFn = () => {},
    setComposerSelectionFn = () => {},
    setSelectedMentionSuggestionIndexFn = () => {},
  } = state;

  const {
    inputRef = { current: null },
  } = refs;

  const {
    mentionSuggestions = [],
    selectedMentionSuggestionIndex = 0,
    activeMentionSearch = null,
  } = mentionState;

  const applyMentionSuggestion = useCallback((suggestion) => {
    applyGuildChatMentionSelection(buildGuildChatMentionSelectionOptions({
      suggestion,
      activeMentionSearch,
      draft,
      setDraftFn,
      setSelectedMentionSuggestionIndexFn,
      inputRef,
      setComposerSelectionFn,
    }));
  }, [
    activeMentionSearch,
    draft,
    inputRef,
    setComposerSelectionFn,
    setDraftFn,
    setSelectedMentionSuggestionIndexFn,
  ]);

  const handleKeyDown = useCallback((event) => {
    handleGuildChatComposerKeyEvent(buildGuildChatComposerKeyOptions({
      event,
      mentionSuggestions,
      selectedMentionSuggestionIndex,
      setSelectedMentionSuggestionIndexFn,
      applyMentionSuggestionFn: applyMentionSuggestion,
      handleSendFn: handleSend,
      setComposerSelectionFn,
    }));
  }, [
    applyMentionSuggestion,
    handleSend,
    mentionSuggestions,
    selectedMentionSuggestionIndex,
    setComposerSelectionFn,
    setSelectedMentionSuggestionIndexFn,
  ]);

  return {
    handleKeyDown,
    applyMentionSuggestion,
  };
}
