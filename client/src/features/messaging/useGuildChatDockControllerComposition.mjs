import { buildUseGuildChatDockControllerRuntimeInput } from './guildChatDockControllerCompositionInputs.mjs';
import { useGuildChatDockControllerEffects } from './useGuildChatDockControllerEffects.mjs';
import { useGuildChatDockControllerRuntime } from './useGuildChatDockControllerRuntime.mjs';

export function useGuildChatDockControllerComposition({
  guildChat,
  hidden = false,
  state = {},
  viewState = {},
} = {}) {
  const effects = useGuildChatDockControllerEffects({
    guildChat,
    hidden,
    state,
    viewState,
  });

  const controllerRuntime = useGuildChatDockControllerRuntime(
    buildUseGuildChatDockControllerRuntimeInput({
      guildChat,
      state,
      viewState,
      effects,
    })
  );

  return {
    focusComposer: effects.focusComposerInput,
    syncComposerSelection: effects.syncComposerSelection,
    handleFeedScroll: effects.handleFeedScroll,
    syncFullscreenLayout: effects.syncFullscreenLayout,
    syncFullscreenCollapse: effects.syncFullscreenCollapse,
    ...controllerRuntime,
  };
}
