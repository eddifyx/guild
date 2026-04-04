import { useMessagesControllerActionRuntime } from './useMessagesControllerActionRuntime.mjs';
import { useMessagesControllerEffectRuntime } from './useMessagesControllerEffectRuntime.mjs';
import { useMessagesControllerSupportRuntime } from './useMessagesControllerSupportRuntime.mjs';

export function useMessagesControllerRuntime({
  conversation = null,
  user = null,
  userId = null,
  socket = null,
  messages = [],
  loading = false,
  hasMore = true,
  perfTraceId = null,
  refs = {},
  setters = {},
  flows = {},
  runtime = {},
  windowObject = globalThis.window || globalThis,
  consoleWarnFn = () => {},
  consoleErrorFn = () => {},
} = {}) {
  const support = useMessagesControllerSupportRuntime({
    refs,
    windowObject,
  });
  const actions = useMessagesControllerActionRuntime({
    socket,
    conversation,
    user,
    userId,
    messages,
    loading,
    hasMore,
    perfTraceId,
    refs: support.refs,
    setters,
    flows,
    clearDeferredRoomSenderKeySync: support.clearDeferredRoomSenderKeySync,
    windowObject,
    consoleWarnFn,
    consoleErrorFn,
  });

  useMessagesControllerEffectRuntime({
    conversation,
    userId,
    socket,
    messages,
    hasMore,
    refs: support.refs,
    setters,
    runtime,
    actions,
    clearDeferredRoomSenderKeySync: support.clearDeferredRoomSenderKeySync,
  });

  return actions;
}
