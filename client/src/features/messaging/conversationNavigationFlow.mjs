export function areConversationsEqual(previousConversation, nextConversation) {
  const previousType = previousConversation?.type || null;
  const previousId = previousConversation?.id || null;
  const previousNpub = previousConversation?.npub || null;
  const previousCollapsing = !!previousConversation?.collapsing;
  const nextType = nextConversation?.type || null;
  const nextId = nextConversation?.id || null;
  const nextNpub = nextConversation?.npub || null;
  const nextCollapsing = !!nextConversation?.collapsing;

  return previousType === nextType
    && previousId === nextId
    && previousNpub === nextNpub
    && previousCollapsing === nextCollapsing;
}

export function applyConversationState(previousConversation, nextConversation) {
  return areConversationsEqual(previousConversation, nextConversation)
    ? previousConversation
    : nextConversation;
}

export function applyConversationName(previousName, nextName = '') {
  return previousName === nextName ? previousName : nextName;
}

export function createConversationSelectionActions({
  clearConversationPerfTrace = () => {},
  setConversationState = () => {},
  setConversationPerfTrace = () => {},
  clearUnreadRoom = () => {},
  clearUnread = () => {},
  socket = null,
  user = null,
  startTrace = () => null,
  setGuildChatExpanded = () => {},
  clearGuildChatUnreadMentions = () => {},
  queueGuildChatComposerFocus = () => {},
  boardsDisabled = false,
} = {}) {
  return {
    handleSelectRoom(room) {
      if (!room || boardsDisabled) {
        clearConversationPerfTrace(boardsDisabled ? 'boards-disabled' : 'cleared-conversation');
        setConversationState(null, '');
        return null;
      }

      setConversationPerfTrace(startTrace('conversation-open', {
        surface: 'main-layout',
        conversationType: 'room',
        conversationId: room.id,
      }));
      socket?.emit?.('room:join', { roomId: room.id });
      setConversationState({ type: 'room', id: room.id }, room.name);
      clearUnreadRoom(room.id);
      return room.id;
    },

    handleSelectDM(conversation) {
      setConversationPerfTrace(startTrace('conversation-open', {
        surface: 'main-layout',
        conversationType: 'dm',
        conversationId: conversation.other_user_id,
      }));
      setConversationState(
        { type: 'dm', id: conversation.other_user_id, npub: conversation.other_npub || null },
        conversation.other_username
      );
      clearUnread(conversation.other_user_id);
      return conversation.other_user_id;
    },

    handleSelectAssetDump() {
      clearConversationPerfTrace('asset-dump');
      setConversationState({ type: 'assets', id: 'dump' }, 'Asset Dumping Grounds');
      return 'assets';
    },

    handleSelectAddons() {
      clearConversationPerfTrace('addons');
      setConversationState({ type: 'addons', id: 'addons' }, 'Addons');
      return 'addons';
    },

    handleSelectStream(userId, username) {
      clearConversationPerfTrace('stream');
      setConversationState(
        { type: 'stream', id: userId || null },
        userId ? `${username}'s Stream` : 'Stream'
      );
      return userId || null;
    },

    handleSelectNostrProfile() {
      clearConversationPerfTrace('nostr-profile');
      setConversationState({ type: 'nostr-profile' }, user?.username || 'Profile');
      return 'nostr-profile';
    },

    handleSelectVoiceChannel(channelId, channelName) {
      clearConversationPerfTrace('voice');
      setConversationState({ type: 'voice', id: channelId }, channelName || 'Voice');
      return channelId;
    },

    handleSelectGuildChatHome() {
      clearConversationPerfTrace('guildchat-home');
      clearGuildChatUnreadMentions();
      setConversationState(null, '');
      queueGuildChatComposerFocus();
      return 'guildchat-home';
    },

    handleSelectGuildChatFull() {
      setGuildChatExpanded(true);
      clearGuildChatUnreadMentions();
      queueGuildChatComposerFocus();
      return 'guildchat-full';
    },

    handleCollapseGuildChatFull({ hasConversation = false } = {}) {
      setGuildChatExpanded(false);
      if (!hasConversation) {
        queueGuildChatComposerFocus();
      }
      return hasConversation ? 'collapsed-with-conversation' : 'collapsed-home';
    },
  };
}
