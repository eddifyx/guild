export function buildSidebarUserBarState({
  user = null,
  connected = false,
  notificationsMuted = false,
} = {}) {
  return {
    username: user?.username || '',
    avatarColor: user?.avatarColor,
    profilePicture: user?.profilePicture || null,
    indicatorBackground: connected ? 'var(--success)' : 'var(--danger)',
    indicatorShadow: connected ? '0 0 6px rgba(0, 214, 143, 0.4)' : 'none',
    notificationsMuted: Boolean(notificationsMuted),
    notificationButtonTitle: notificationsMuted ? 'Unmute chat notifications' : 'Mute chat notifications',
    notificationButtonColor: notificationsMuted ? 'var(--danger)' : 'var(--text-muted)',
    notificationButtonHoverColor: notificationsMuted ? '#ff9b9b' : 'var(--text-secondary)',
    notificationButtonBackground: notificationsMuted ? 'rgba(255, 92, 92, 0.12)' : 'transparent',
    notificationButtonBorder: notificationsMuted ? '1px solid rgba(255, 92, 92, 0.28)' : '1px solid transparent',
  };
}

export function buildSidebarAssetButtonState({
  conversationType = null,
  targetType = '',
} = {}) {
  const isActive = conversationType === targetType;

  return {
    isActive,
    background: isActive ? 'var(--bg-active)' : 'transparent',
    color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
    iconColor: isActive ? 'var(--accent)' : 'var(--text-muted)',
    fontWeight: isActive ? 500 : 400,
  };
}

export function buildSidebarOnlineUsersState({
  onlineUsers = [],
  currentUserId = null,
} = {}) {
  return {
    label: `Online — ${onlineUsers.length}`,
    isEmpty: onlineUsers.length === 0,
    rows: onlineUsers.map((onlineUser) => ({
      ...onlineUser,
      isCurrentUser: onlineUser.userId === currentUserId,
    })),
  };
}
