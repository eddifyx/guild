import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildGuildSettingsMemberState,
  buildGuildSettingsShellState,
} from '../../../client/src/features/guild/guildSettingsControllerModel.mjs';

test('guild settings controller model derives the current member and guild-master rank state', () => {
  assert.deepEqual(
    buildGuildSettingsMemberState({
      members: [
        { id: 'user-1', rankOrder: 0 },
        { id: 'user-2', rankOrder: 2 },
      ],
      userId: 'user-1',
    }),
    {
      myMember: { id: 'user-1', rankOrder: 0 },
      myRankOrder: 0,
      isGuildMaster: true,
    }
  );
});

test('guild settings controller model derives title, visible tabs, and leave-footer state', () => {
  const shellState = buildGuildSettingsShellState({
    permissionsReady: true,
    myMember: {
      rankOrder: 2,
      effectivePermissions: {
        invite_member: true,
        set_permissions: false,
        manage_theme: false,
        modify_motd: false,
      },
    },
  });

  assert.equal(shellState.title, 'Guild Info');
  assert.equal(shellState.permissionsReady, true);
  assert.deepEqual(shellState.visibleTabs, ['Overview', 'Members', 'Invite']);
  assert.equal(shellState.showLeaveFooter, true);
});

test('guild settings controller model keeps the loading title until permissions are ready', () => {
  const shellState = buildGuildSettingsShellState({
    permissionsReady: false,
    myMember: null,
  });

  assert.equal(shellState.title, 'Loading...');
  assert.equal(shellState.permissionsReady, false);
  assert.equal(shellState.showLeaveFooter, false);
});
