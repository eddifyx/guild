export function selectSidebarDmUser({
  user = null,
  setDMConversationsFn = () => {},
  appendSidebarDmConversationFn = ({ previousConversations }) => previousConversations,
  rememberUserNpubFn = () => {},
  trustUserNpubFn = () => {},
  onSelectDMFn = () => {},
} = {}) {
  if (!user) return;

  setDMConversationsFn((previousConversations) => appendSidebarDmConversationFn({
    previousConversations,
    user,
    rememberUserNpubFn,
    trustUserNpubFn,
  }));

  onSelectDMFn({
    other_user_id: user.id,
    other_username: user.username,
    other_npub: user.npub || null,
  });
}

export function removeSidebarDmConversationFlow({
  socket = null,
  otherUserId = null,
  setDMConversationsFn = () => {},
  removeSidebarDmConversationFn = ({ previousConversations }) => previousConversations,
  conversation = null,
  onSelectRoomFn = () => {},
} = {}) {
  if (!socket || !otherUserId) return false;

  socket.emit('dm:conversation:delete', { otherUserId });
  setDMConversationsFn((previousConversations) => removeSidebarDmConversationFn({
    previousConversations,
    otherUserId,
  }));

  if (conversation?.type === 'dm' && conversation.id === otherUserId) {
    onSelectRoomFn(null);
  }

  return true;
}
