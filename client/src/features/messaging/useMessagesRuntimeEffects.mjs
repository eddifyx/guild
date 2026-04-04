import { useMessagesRetryEffects } from './useMessagesRetryEffects.mjs';
import { useMessagesStateEffects } from './useMessagesStateEffects.mjs';
import { useMessagesSubscriptionEffects } from './useMessagesSubscriptionEffects.mjs';
import { useMessagesDecryptDebugLogEffect } from './useMessagesDecryptDebugLogEffect.mjs';
import { useMessagesDebugSurfaceEffect } from './useMessagesDebugSurfaceEffect.mjs';

export function useMessagesRuntimeEffects({
  conversation = null,
  userId = null,
  socket = null,
  messages = [],
  hasMore = true,
  refs = {},
  setters = {},
  actions = {},
  runtime = {},
} = {}) {
  useMessagesStateEffects({
    conversation,
    userId,
    messages,
    hasMore,
    refs,
    setters,
    runtime,
  });

  useMessagesRetryEffects({
    conversation,
    userId,
    messages,
    hasMore,
    refs,
    setters,
    actions,
    runtime,
  });

  useMessagesSubscriptionEffects({
    socket,
    conversation,
    userId,
    messages,
    hasMore,
    refs,
    setters,
    runtime,
  });

  useMessagesDebugSurfaceEffect({
    conversation,
    userId,
    messages,
    windowObj: runtime.windowObj,
  });

  useMessagesDecryptDebugLogEffect({
    windowObj: runtime.windowObj,
  });
}
