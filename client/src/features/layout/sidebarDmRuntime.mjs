import { buildSidebarIncomingDmConversation } from './sidebarModel.mjs';

export async function fetchSidebarDmConversations({
  apiFn = async () => [],
  rememberUsersFn = () => {},
} = {}) {
  const conversations = await apiFn('/api/dm/conversations');
  rememberUsersFn(conversations);
  return conversations.map((conversation) => ({
    other_user_id: conversation.other_user_id,
    other_username: conversation.other_username,
    other_avatar_color: conversation.other_avatar_color,
    other_profile_picture: conversation.other_profile_picture || null,
    other_npub: conversation.other_npub || null,
  }));
}

export function reconcileSidebarDmConversations({
  previousConversations = [],
  mergeDMConversationMetaFn = (conversation) => conversation,
} = {}) {
  let changed = false;
  const next = previousConversations.map((conversation) => {
    const updated = mergeDMConversationMetaFn(conversation);
    if (updated !== conversation) {
      changed = true;
    }
    return updated;
  });
  return changed ? next : previousConversations;
}

export function applySidebarIncomingDmMessage({
  previousConversations = [],
  message = {},
  currentUserId = null,
  mergeDMConversationMetaFn = (conversation) => conversation,
  rememberUserNpubFn = () => {},
} = {}) {
  const { otherUserId, fallback } = buildSidebarIncomingDmConversation({
    message,
    currentUserId,
  });

  if (message.sender_id !== currentUserId && message.sender_npub) {
    rememberUserNpubFn(otherUserId, message.sender_npub);
  }

  const existingIndex = previousConversations.findIndex(
    (conversation) => conversation.other_user_id === otherUserId,
  );
  const baseConversation = existingIndex >= 0
    ? previousConversations[existingIndex]
    : {
      other_user_id: otherUserId,
      other_username: fallback.username || otherUserId,
      other_avatar_color: fallback.avatarColor || '#40FF40',
      other_profile_picture: fallback.profilePicture || null,
      other_npub: fallback.npub || null,
    };

  const nextConversation = mergeDMConversationMetaFn(baseConversation, fallback);
  if (existingIndex >= 0) {
    if (nextConversation === baseConversation) {
      return previousConversations;
    }
    const next = [...previousConversations];
    next[existingIndex] = nextConversation;
    return next;
  }

  return [...previousConversations, nextConversation];
}

export function appendSidebarDmConversation({
  previousConversations = [],
  user = null,
  rememberUserNpubFn = () => {},
  trustUserNpubFn = () => {},
} = {}) {
  if (user?.npub) {
    if (user.trustedBootstrap) {
      trustUserNpubFn(user.id, user.npub);
    } else {
      rememberUserNpubFn(user.id, user.npub);
    }
  }

  const exists = previousConversations.find(
    (conversation) => conversation.other_user_id === user?.id,
  );
  if (exists) return previousConversations;

  return [
    ...previousConversations,
    {
      other_user_id: user?.id,
      other_username: user?.username,
      other_avatar_color: user?.avatar_color,
      other_profile_picture: user?.profile_picture || user?.profilePicture || null,
      other_npub: user?.npub || null,
    },
  ];
}

export function removeSidebarDmConversation({
  previousConversations = [],
  otherUserId = null,
} = {}) {
  return previousConversations.filter(
    (conversation) => conversation.other_user_id !== otherUserId,
  );
}
