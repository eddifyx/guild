import { useGuildSettingsControllerActionView } from './useGuildSettingsControllerActionView.mjs';
import { useGuildSettingsControllerSupport } from './useGuildSettingsControllerSupport.mjs';

export function useGuildSettingsControllerComposition({
  currentGuild = null,
  currentGuildData = null,
  userId = null,
  openTraceId = null,
  onClose = () => {},
  state = {},
  derived = {},
  deps = {},
} = {}) {
  const support = useGuildSettingsControllerSupport({
    currentGuild,
    currentGuildData,
    openTraceId,
    onClose,
    state,
    deps,
  });

  return useGuildSettingsControllerActionView({
    currentGuild,
    currentGuildData,
    userId,
    onClose,
    state,
    derived,
    deps,
    support,
  });
}
