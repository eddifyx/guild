import { useMessagesHydrationEffects } from './useMessagesHydrationEffects.mjs';
import { useMessagesResetEffects } from './useMessagesResetEffects.mjs';

export function useMessagesStateEffects({
  conversation = null,
  userId = null,
  messages = [],
  hasMore = true,
  refs = {},
  setters = {},
  runtime = {},
} = {}) {
  useMessagesResetEffects({
    userId,
    messages,
    refs,
    setters,
    runtime,
  });

  useMessagesHydrationEffects({
    conversation,
    userId,
    messages,
    refs,
    setters,
    runtime,
  });
}
