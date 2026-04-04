import { useEffect, useRef } from 'react';

function getConversationEffectKey(conversation = null) {
  if (!conversation) return null;

  return [
    conversation.type || '',
    conversation.id || '',
  ].join(':');
}

export function useMessagesRetryActionEffects({
  conversation = null,
  userId = null,
  messages = [],
  actions = {},
  runtime = {},
} = {}) {
  const {
    retryFailedVisibleMessagesFn = async () => {},
    reloadMessagesFn = async () => {},
  } = actions;
  const {
    shouldRetryFailedDMConversationMessagesFn = () => false,
  } = runtime;
  const retryFailedVisibleMessagesRef = useRef(retryFailedVisibleMessagesFn);
  const reloadMessagesRef = useRef(reloadMessagesFn);
  const shouldRetryFailedDMConversationMessagesRef = useRef(shouldRetryFailedDMConversationMessagesFn);
  const conversationEffectKey = getConversationEffectKey(conversation);

  retryFailedVisibleMessagesRef.current = retryFailedVisibleMessagesFn;
  reloadMessagesRef.current = reloadMessagesFn;
  shouldRetryFailedDMConversationMessagesRef.current = shouldRetryFailedDMConversationMessagesFn;

  useEffect(() => {
    if (!shouldRetryFailedDMConversationMessagesRef.current({
      conversation,
      messages,
      userId,
    })) return;

    void retryFailedVisibleMessagesRef.current();
  }, [
    conversationEffectKey,
    messages,
    userId,
  ]);

  useEffect(() => {
    if (!conversation) return;

    void reloadMessagesRef.current();
  }, [conversationEffectKey]);
}
