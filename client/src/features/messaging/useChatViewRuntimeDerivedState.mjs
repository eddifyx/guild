import { useMemo } from 'react';

import { getEffectiveConversation, isConversationDmSupported } from './chatViewModel.mjs';
import { getChatViewTrustBootstrapState } from './chatViewRuntimeModel.mjs';

export function useChatViewRuntimeDerivedState({
  conversation,
  currentGuildData = null,
  guildLoading = false,
  getKnownNpubFn,
} = {}) {
  return useMemo(() => {
    const dmSupported = isConversationDmSupported(conversation, currentGuildData, guildLoading);
    const effectiveConversation = getEffectiveConversation(conversation, dmSupported);

    return {
      effectiveConversation,
      dmUnavailable: effectiveConversation?.type === 'dm' && effectiveConversation?.dmUnsupported,
      trustBootstrapState: getChatViewTrustBootstrapState(effectiveConversation, getKnownNpubFn),
    };
  }, [conversation, currentGuildData, guildLoading, getKnownNpubFn]);
}
