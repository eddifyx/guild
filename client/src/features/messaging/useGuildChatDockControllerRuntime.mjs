import { useGuildChatDockControllerComposerRuntime } from './useGuildChatDockControllerComposerRuntime.mjs';
import { useGuildChatDockControllerUploadRuntime } from './useGuildChatDockControllerUploadRuntime.mjs';

export function useGuildChatDockControllerRuntime({
  guildChat = {},
  state = {},
  refs = {},
  mentionState = {},
  runtime = {},
} = {}) {
  const uploadRuntime = useGuildChatDockControllerUploadRuntime({
    guildChat,
    state,
    refs,
  });
  const composerRuntime = useGuildChatDockControllerComposerRuntime({
    guildChat,
    state,
    refs,
    mentionState,
    runtime,
  });

  return {
    ...uploadRuntime,
    ...composerRuntime,
  };
}
