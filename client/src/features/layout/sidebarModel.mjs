export function canSidebarManageRooms(currentGuildData = null) {
  if (currentGuildData?.myRank?.order === 0) return true;
  return Boolean(currentGuildData?.myRank?.permissions?.manage_rooms);
}

export function buildSidebarGuildHeaderState({
  currentGuildData = null,
  sidebarGuildImgFailed = false,
  guildChatMentionUnread = false,
  conversation = null,
  getFileUrlFn = (value) => value,
} = {}) {
  const isTavernActive = !conversation;
  const guildDisplayName = currentGuildData?.name || '/guild';
  const guildImagePath = currentGuildData?.image_url || null;
  const guildImageUrl = guildImagePath && !sidebarGuildImgFailed
    ? getFileUrlFn(guildImagePath)
    : null;

  return {
    isTavernActive,
    guildDisplayName,
    guildImageUrl,
    guildNameColor: isTavernActive
      ? '#40FF40'
      : guildChatMentionUnread
        ? '#ffb35c'
        : 'var(--text-primary)',
    guildNameTextShadow: isTavernActive
      ? '0 0 12px rgba(64, 255, 64, 0.18)'
      : guildChatMentionUnread
        ? '0 0 12px rgba(255, 166, 77, 0.18)'
        : 'none',
    tavernMetaColor: isTavernActive
      ? 'rgba(64, 255, 64, 0.9)'
      : guildChatMentionUnread
        ? 'rgba(255, 197, 122, 0.94)'
        : 'var(--text-muted)',
  };
}

export function resolveSidebarDmUserMeta({
  guildMembersById = new Map(),
  onlineUsersById = new Map(),
  otherUserId = null,
  fallback = {},
} = {}) {
  const guildMember = guildMembersById.get(otherUserId);
  const onlineUser = onlineUsersById.get(otherUserId);

  return {
    username:
      guildMember?.username
      || onlineUser?.username
      || fallback.username
      || otherUserId,
    avatarColor:
      guildMember?.avatarColor
      || guildMember?.avatar_color
      || onlineUser?.avatarColor
      || fallback.avatarColor
      || '#40FF40',
    profilePicture:
      guildMember?.profilePicture
      || guildMember?.profile_picture
      || onlineUser?.profilePicture
      || fallback.profilePicture
      || null,
    npub:
      guildMember?.npub
      || onlineUser?.npub
      || fallback.npub
      || null,
  };
}

export function mergeSidebarDmConversationMeta({
  conversation,
  resolvedMeta = {},
} = {}) {
  const nextUsername = resolvedMeta.username || conversation.other_username || conversation.other_user_id;
  const nextAvatarColor = resolvedMeta.avatarColor || conversation.other_avatar_color || '#40FF40';
  const nextProfilePicture = resolvedMeta.profilePicture || conversation.other_profile_picture || null;
  const nextNpub = resolvedMeta.npub || conversation.other_npub || null;

  if (
    conversation.other_username === nextUsername
    && conversation.other_avatar_color === nextAvatarColor
    && (conversation.other_profile_picture || null) === nextProfilePicture
    && conversation.other_npub === nextNpub
  ) {
    return conversation;
  }

  return {
    ...conversation,
    other_username: nextUsername,
    other_avatar_color: nextAvatarColor,
    other_profile_picture: nextProfilePicture,
    other_npub: nextNpub,
  };
}

export function buildSidebarIncomingDmConversation({
  message,
  currentUserId = null,
} = {}) {
  const otherUserId = message.sender_id === currentUserId
    ? message.dm_partner_id
    : message.sender_id;

  return {
    otherUserId,
    fallback: {
      username: message.sender_id === currentUserId ? null : message.sender_name,
      avatarColor: message.sender_id === currentUserId ? null : message.sender_color,
      profilePicture: message.sender_id === currentUserId ? null : message.sender_picture,
      npub: message.sender_id === currentUserId ? null : message.sender_npub,
    },
  };
}
