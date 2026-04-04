import { useGuildChatDockControllerDraftRuntime } from './useGuildChatDockControllerDraftRuntime.mjs';
import { useGuildChatDockControllerMentionRuntime } from './useGuildChatDockControllerMentionRuntime.mjs';

export function useGuildChatDockControllerComposerRuntime({
  guildChat = {},
  state = {},
  refs = {},
  mentionState = {},
  runtime = {},
} = {}) {
  const draftRuntime = useGuildChatDockControllerDraftRuntime({
    guildChat,
    state,
    refs,
    runtime,
  });
  const mentionRuntime = useGuildChatDockControllerMentionRuntime({
    state,
    refs,
    mentionState,
    runtime,
    handleSend: draftRuntime.handleSend,
  });

  return {
    ...draftRuntime,
    ...mentionRuntime,
  };
}
