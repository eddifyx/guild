import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildGuildSettingsGuildSyncState,
  buildGuildSettingsResetState,
  buildGuildSettingsTabLoadPlan,
  buildGuildSettingsWarmLoadPlan,
} from '../../../client/src/features/guild/guildSettingsRuntimeModel.mjs';

test('guild settings runtime model builds canonical reset state', () => {
  assert.deepEqual(
    buildGuildSettingsResetState(),
    {
      ranks: [],
      ranksLoaded: false,
      inviteCode: '',
      inviteLoaded: false,
      motd: '',
      motdLoaded: false,
      loading: { members: false, ranks: false, invite: false, motd: false },
    }
  );
});

test('guild settings runtime model syncs guild data only when it matches the active guild', () => {
  assert.deepEqual(
    buildGuildSettingsGuildSyncState({
      currentGuild: 'guild-1',
      currentGuildData: {
        id: 'guild-1',
        name: 'Builders',
        description: 'Ship it',
        is_public: 1,
        image_url: '/uploads/guild.png',
        members: [{ id: 'user-1' }],
      },
    }),
    {
      guildName: 'Builders',
      guildDesc: 'Ship it',
      guildPublic: true,
      guildImage: '/uploads/guild.png',
      members: [{ id: 'user-1' }],
      membersLoaded: true,
    }
  );

  assert.equal(
    buildGuildSettingsGuildSyncState({
      currentGuild: 'guild-2',
      currentGuildData: { id: 'guild-1', members: [{ id: 'user-1' }] },
    }).membersLoaded,
    false
  );
});

test('guild settings runtime model derives warm-load and tab-load plans consistently', () => {
  assert.deepEqual(
    buildGuildSettingsWarmLoadPlan({
      currentGuild: 'guild-1',
      membersLoaded: false,
      motdLoaded: true,
      ranksLoaded: false,
    }),
    {
      loadMembers: true,
      loadMotd: false,
      warmRanks: true,
    }
  );

  assert.deepEqual(
    buildGuildSettingsTabLoadPlan({
      currentGuild: 'guild-1',
      tab: 'Invite',
      membersLoaded: true,
      ranksLoaded: false,
      inviteLoaded: false,
      motdLoaded: true,
    }),
    {
      loadMembers: false,
      loadRanks: false,
      loadInvite: true,
      loadMotd: false,
    }
  );
});
