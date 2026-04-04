import { useGuildSettingsLoadEffects } from './useGuildSettingsLoadEffects.mjs';
import { useGuildSettingsResetEffects } from './useGuildSettingsResetEffects.mjs';
import { useGuildSettingsShellEffects } from './useGuildSettingsShellEffects.mjs';

export function useGuildSettingsRuntimeEffects({
  currentGuild = null,
  currentGuildData = null,
  tab = 'Overview',
  membersLoaded = false,
  ranksLoaded = false,
  inviteLoaded = false,
  motdLoaded = false,
  openTraceId = null,
  onClose = () => {},
  refs = {},
  state = {},
  load = {},
  endPerfTraceAfterNextPaintFn = () => {},
} = {}) {
  useGuildSettingsResetEffects({
    currentGuild,
    currentGuildData,
    refs,
    state,
  });

  useGuildSettingsLoadEffects({
    currentGuild,
    tab,
    membersLoaded,
    ranksLoaded,
    inviteLoaded,
    motdLoaded,
    load,
  });

  useGuildSettingsShellEffects({
    openTraceId,
    onClose,
    refs,
    endPerfTraceAfterNextPaintFn,
  });
}
