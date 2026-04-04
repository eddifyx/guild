export const VERSION_CHECK_INTERVAL_MS = 30 * 60 * 1000;

export function bindE2EWarningEvents({
  windowObj,
  setE2eWarningFn,
  wasE2EExpectedFn,
} = {}) {
  if (!windowObj?.addEventListener || !windowObj?.removeEventListener) return () => {};

  const onE2eFailed = () => setE2eWarningFn?.(true);
  windowObj.addEventListener('e2e-init-failed', onE2eFailed);
  if (wasE2EExpectedFn?.()) {
    setE2eWarningFn?.(true);
  }

  return () => windowObj.removeEventListener('e2e-init-failed', onE2eFailed);
}

export function syncE2EWarningState({
  e2eWarning,
  isE2EInitializedFn,
  setE2eWarningFn,
} = {}) {
  if (e2eWarning && isE2EInitializedFn?.()) {
    setE2eWarningFn?.(false);
    return true;
  }
  return false;
}

export function startVersionPolling({
  getAppVersionFn,
  refreshLatestVersionInfoFn,
  setAppVersionFn,
  setIntervalFn = globalThis.setInterval.bind(globalThis),
  clearIntervalFn = globalThis.clearInterval.bind(globalThis),
  warnFn = () => {},
} = {}) {
  getAppVersionFn?.().then((version) => setAppVersionFn?.(version || '')).catch((error) => {
    warnFn?.(error);
  });

  const check = () => refreshLatestVersionInfoFn?.().catch((error) => {
    warnFn?.(error);
  });

  check();
  const intervalId = setIntervalFn(check, VERSION_CHECK_INTERVAL_MS);
  return () => clearIntervalFn(intervalId);
}

export function bindRoomAutoJoin({
  socket,
  myRooms,
} = {}) {
  if (!socket) return () => {};

  const handleConnect = () => {
    (myRooms || []).forEach((room) => {
      socket.emit('room:join', { roomId: room.id });
    });
  };

  if (socket.connected) handleConnect();
  socket.on('connect', handleConnect);
  return () => socket.off('connect', handleConnect);
}

export function bindRoomLifecycle({
  socket,
  conversation,
  clearConversationFn,
  setConversationNameFn,
} = {}) {
  if (!socket) return () => {};

  const onDeleted = ({ roomId }) => {
    if (conversation?.type === 'room' && conversation.id === roomId) {
      clearConversationFn?.();
    }
  };

  const onRenamed = ({ roomId, name }) => {
    if (conversation?.type === 'room' && conversation.id === roomId) {
      setConversationNameFn?.(name);
    }
  };

  socket.on('room:deleted', onDeleted);
  socket.on('room:renamed', onRenamed);
  return () => {
    socket.off('room:deleted', onDeleted);
    socket.off('room:renamed', onRenamed);
  };
}

export function bindComposerShortcut({
  windowObj,
  documentObj,
  isTextEntryTargetFn,
  focusComposerFn,
} = {}) {
  if (!windowObj?.addEventListener || !windowObj?.removeEventListener) return () => {};

  const handleComposerShortcut = (event) => {
    if (event.key !== 'Tab' || event.defaultPrevented) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (documentObj?.querySelector?.('[data-modal-root="true"]')) return;
    if (isTextEntryTargetFn?.(event.target)) return;

    const composer = documentObj?.querySelector?.('[data-primary-composer="chat"], [data-primary-composer="guildchat"]');
    if (!composer) return;

    event.preventDefault?.();
    focusComposerFn?.(composer);
  };

  windowObj.addEventListener('keydown', handleComposerShortcut);
  return () => windowObj.removeEventListener('keydown', handleComposerShortcut);
}

export function bindSystemNotificationActions({
  subscribeFn,
  handleNotificationActionFn,
} = {}) {
  if (typeof subscribeFn !== 'function') return undefined;
  return subscribeFn((payload = {}) => {
    handleNotificationActionFn?.(payload);
  });
}
