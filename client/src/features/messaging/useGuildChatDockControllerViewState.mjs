import { useEffect, useMemo } from 'react';

import {
  buildGuildChatComposerAccess,
  buildGuildChatLiveEntries,
  buildGuildChatSendState,
  normalizeGuildChatMentionSelectionIndex,
} from './guildChatDockModel.mjs';
import { findGuildMentionSuggestions } from './guildChatMentions.js';

export function useGuildChatDockControllerViewState({
  guildChat,
  currentGuildData = null,
  currentUserId = null,
  draft = '',
  composerSelection = { start: 0, end: 0 },
  selectedMentionSuggestionIndex = 0,
  setSelectedMentionSuggestionIndex = () => {},
  pendingFiles = [],
  sending = false,
} = {}) {
  const {
    messages = [],
    typingUsers = [],
    motdEntry = null,
    lastError = '',
    connected = false,
    canListen = true,
    canSpeak = true,
  } = guildChat || {};

  const { composerDisabledReason, canCompose } = useMemo(() => (
    buildGuildChatComposerAccess({
      connected,
      canListen,
      canSpeak,
    })
  ), [connected, canListen, canSpeak]);

  const mentionSuggestionResult = useMemo(() => (
    findGuildMentionSuggestions(draft, composerSelection.start, currentGuildData?.members || [], {
      excludeUserId: currentUserId,
    })
  ), [draft, composerSelection.start, currentGuildData?.members, currentUserId]);
  const mentionSuggestions = mentionSuggestionResult.suggestions || [];
  const activeMentionSearch = mentionSuggestionResult.state;

  useEffect(() => {
    const nextSelectedIndex = normalizeGuildChatMentionSelectionIndex({
      mentionSuggestions,
      selectedIndex: selectedMentionSuggestionIndex,
    });
    if (nextSelectedIndex !== selectedMentionSuggestionIndex) {
      setSelectedMentionSuggestionIndex(nextSelectedIndex);
    }
  }, [
    mentionSuggestions,
    selectedMentionSuggestionIndex,
    setSelectedMentionSuggestionIndex,
  ]);

  const liveEntries = useMemo(
    () => buildGuildChatLiveEntries({ motdEntry, messages }),
    [motdEntry, messages],
  );

  const { canSend } = useMemo(() => (
    buildGuildChatSendState({
      draft,
      pendingFiles,
      canCompose,
      sending,
    })
  ), [draft, pendingFiles, canCompose, sending]);

  return {
    lastError,
    typingUsers,
    composerDisabledReason,
    canCompose,
    mentionSuggestions,
    activeMentionSearch,
    liveEntries,
    canSend,
  };
}
