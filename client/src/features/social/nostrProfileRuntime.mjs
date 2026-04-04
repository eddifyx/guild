export function resolveCurrentNostrPubkey({
  user = null,
  getUserPubkeyFn,
  decodeNpubFn,
} = {}) {
  let pubkey = typeof getUserPubkeyFn === 'function' ? getUserPubkeyFn() : null;
  if (!pubkey && user?.npub && typeof decodeNpubFn === 'function') {
    try {
      pubkey = decodeNpubFn(user.npub)?.data || null;
    } catch {
      pubkey = null;
    }
  }
  return pubkey || null;
}

export async function loadNostrProfileSnapshot({
  user = null,
  fetchCurrentProfileFn,
  getUserPubkeyFn,
  decodeNpubFn,
} = {}) {
  const pubkey = resolveCurrentNostrPubkey({ user, getUserPubkeyFn, decodeNpubFn });
  if (!pubkey || typeof fetchCurrentProfileFn !== 'function') {
    return null;
  }
  return fetchCurrentProfileFn(pubkey);
}

export function createCopyNpubAction({
  npub = '',
  writeTextFn,
  setCopiedFn,
  setTimeoutFn = setTimeout,
  clearDelayMs = 2000,
} = {}) {
  return async () => {
    if (!npub || typeof writeTextFn !== 'function') {
      return false;
    }
    await writeTextFn(npub);
    setCopiedFn?.(true);
    setTimeoutFn?.(() => setCopiedFn?.(false), clearDelayMs);
    return true;
  };
}

export function createStatusSaveAction({
  socket = null,
  getStatusDraftFn,
  setEditingStatusFn,
  maxLength = 128,
} = {}) {
  return () => {
    const nextStatus = (typeof getStatusDraftFn === 'function' ? getStatusDraftFn() : '')
      .trim()
      .slice(0, maxLength);
    socket?.emit?.('status:update', { status: nextStatus });
    setEditingStatusFn?.(false);
    return nextStatus;
  };
}

export function createStartEditStatusAction({
  getCurrentStatusFn,
  setStatusDraftFn,
  setEditingStatusFn,
} = {}) {
  return () => {
    const currentStatus = typeof getCurrentStatusFn === 'function' ? getCurrentStatusFn() : '';
    setStatusDraftFn?.(currentStatus || '');
    setEditingStatusFn?.(true);
  };
}

export function createLeaveGuildDialog({
  currentGuild = null,
  currentGuildData = null,
  leaveGuildFn,
  clearGuildFn,
  setFlashMsgFn,
  setTimeoutFn = setTimeout,
} = {}) {
  return {
    title: 'Leave Guild',
    message: `Leave ${currentGuildData?.name || 'this guild'}? You'll need to join or create a new guild.`,
    danger: false,
    confirmLabel: 'Leave',
    onConfirm: async () => {
      try {
        await leaveGuildFn?.(currentGuild);
        clearGuildFn?.();
      } catch (error) {
        setFlashMsgFn?.(error?.message || 'Failed to leave guild');
        setTimeoutFn?.(() => setFlashMsgFn?.(null), 4000);
      }
    },
  };
}

export function createLogoutDialog({ logoutFn } = {}) {
  return {
    title: 'Log Out',
    message: 'Are you sure you want to log out?',
    danger: false,
    confirmLabel: 'Log Out',
    onConfirm: () => logoutFn?.(),
  };
}

