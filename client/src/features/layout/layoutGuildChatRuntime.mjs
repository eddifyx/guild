export function focusGuildChatComposer({
  windowObj,
} = {}) {
  if (!windowObj?.requestAnimationFrame || !windowObj?.dispatchEvent) {
    return false;
  }

  const CustomEventCtor = windowObj?.CustomEvent || globalThis.CustomEvent;
  windowObj.requestAnimationFrame(() => {
    const event = typeof CustomEventCtor === 'function'
      ? new CustomEventCtor('guildchat:focus-composer')
      : { type: 'guildchat:focus-composer' };
    windowObj.dispatchEvent(event);
  });
  return true;
}

export function queueGuildChatComposerFocus({
  windowObj,
  focusGuildChatComposerFn,
  delays = [0, 90, 220],
} = {}) {
  const setTimeoutFn = windowObj?.setTimeout?.bind(windowObj) || globalThis.setTimeout.bind(globalThis);
  return delays.map((delay) => setTimeoutFn(() => {
    focusGuildChatComposerFn?.();
  }, delay));
}

export function syncGuildChatDockState({
  conversation,
  setGuildChatCompactFn,
  guildChatInitialFocusAppliedRef,
} = {}) {
  if (!conversation) return false;
  setGuildChatCompactFn?.(false);
  if (guildChatInitialFocusAppliedRef) {
    guildChatInitialFocusAppliedRef.current = false;
  }
  return true;
}

export function syncStreamImmersiveState({
  conversationType,
  streamImmersive,
  setStreamImmersiveFn,
} = {}) {
  if (conversationType !== 'stream' && streamImmersive) {
    setStreamImmersiveFn?.(false);
    return true;
  }
  return false;
}

export function syncGuildChatExpandedState({
  guildChatAvailable,
  guildChatExpanded,
  setGuildChatExpandedFn,
} = {}) {
  if (!guildChatAvailable && guildChatExpanded) {
    setGuildChatExpandedFn?.(false);
    return true;
  }
  return false;
}

export function scheduleInitialGuildChatComposerFocus({
  showGuildChatDock,
  conversation,
  currentGuildData,
  guildChatInitialFocusAppliedRef,
  documentObj,
  windowObj,
  focusGuildChatComposerFn,
  delays = [0, 140, 420],
} = {}) {
  if (!showGuildChatDock || conversation || !currentGuildData) return () => {};
  if (guildChatInitialFocusAppliedRef?.current) return () => {};

  const active = documentObj?.activeElement;
  const tagName = typeof active?.tagName === 'string' ? active.tagName.toUpperCase() : '';
  const isTypingAlready = (
    tagName === 'INPUT'
    || tagName === 'TEXTAREA'
    || tagName === 'SELECT'
    || !!active?.isContentEditable
  );
  if (isTypingAlready) return () => {};

  if (guildChatInitialFocusAppliedRef) {
    guildChatInitialFocusAppliedRef.current = true;
  }

  const setTimeoutFn = windowObj?.setTimeout?.bind(windowObj) || globalThis.setTimeout.bind(globalThis);
  const clearTimeoutFn = windowObj?.clearTimeout?.bind(windowObj) || globalThis.clearTimeout.bind(globalThis);
  const timers = delays.map((delay) => setTimeoutFn(() => {
    focusGuildChatComposerFn?.();
  }, delay));

  return () => timers.forEach((timer) => clearTimeoutFn(timer));
}
