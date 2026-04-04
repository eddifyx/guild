import { useMessagesLifecycleSubscriptionEffects } from './useMessagesLifecycleSubscriptionEffects.mjs';
import { useMessagesRealtimeSubscriptionEffects } from './useMessagesRealtimeSubscriptionEffects.mjs';

export function useMessagesSubscriptionEffects({
  socket = null,
  conversation = null,
  userId = null,
  messages = [],
  hasMore = true,
  refs = {},
  setters = {},
  runtime = {},
} = {}) {
  useMessagesRealtimeSubscriptionEffects({
    socket,
    conversation,
    userId,
    hasMore,
    refs,
    setters,
    runtime,
  });

  useMessagesLifecycleSubscriptionEffects({
    socket,
    conversation,
    userId,
    setters,
    runtime,
  });
}
