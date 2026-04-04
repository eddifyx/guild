import { useMessagesRetryActionEffects } from './useMessagesRetryActionEffects.mjs';
import { useMessagesRetryBindingEffects } from './useMessagesRetryBindingEffects.mjs';

export function useMessagesRetryEffects({
  conversation = null,
  userId = null,
  messages = [],
  hasMore = true,
  refs = {},
  setters = {},
  actions = {},
  runtime = {},
} = {}) {
  useMessagesRetryBindingEffects({
    conversation,
    userId,
    messages,
    hasMore,
    refs,
    setters,
    actions,
    runtime,
  });

  useMessagesRetryActionEffects({
    conversation,
    userId,
    messages,
    actions,
    runtime,
  });
}
