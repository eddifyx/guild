import { useMemo } from 'react';

import {
  buildGuildSettingsMemberState,
  buildGuildSettingsShellState,
} from './guildSettingsControllerModel.mjs';

export function useGuildSettingsControllerDerivedState({
  members = [],
  membersLoaded = false,
  userId = null,
} = {}) {
  return useMemo(() => {
    const memberState = buildGuildSettingsMemberState({
      members,
      userId,
    });

    return {
      ...memberState,
      shellState: buildGuildSettingsShellState({
        permissionsReady: membersLoaded,
        myMember: memberState.myMember,
      }),
    };
  }, [members, membersLoaded, userId]);
}
