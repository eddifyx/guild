import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildGuildDashboardHeaderState,
  buildGuildDashboardProfileCardPayload,
  buildGuildDashboardStatusDraft,
  buildGuildDashboardStatusSubmit,
} from '../../../client/src/features/guild/guildDashboardControllerModel.mjs';

test('guild dashboard controller model trims submitted status text to the canonical limit', () => {
  assert.equal(
    buildGuildDashboardStatusSubmit({
      statusDraft: '  Ready to build  ',
      maxLength: 10,
    }),
    'Ready to b'
  );
});

test('guild dashboard controller model derives display draft and profile-card payload safely', () => {
  assert.equal(
    buildGuildDashboardStatusDraft({
      editingStatus: false,
      statusDraft: 'editing',
      myStatus: 'live',
    }),
    'live'
  );

  assert.deepEqual(
    buildGuildDashboardProfileCardPayload({
      member: { id: 'user-2', username: 'Builder' },
      event: { clientX: 14, clientY: 28 },
      currentUserId: 'user-1',
    }),
    {
      user: { id: 'user-2', username: 'Builder' },
      position: { x: 14, y: 28 },
    }
  );

  assert.equal(
    buildGuildDashboardProfileCardPayload({
      member: { id: 'user-1' },
      event: { clientX: 14, clientY: 28 },
      currentUserId: 'user-1',
    }),
    null
  );
});

test('guild dashboard controller model shapes header state and hides broken guild images', () => {
  assert.deepEqual(
    buildGuildDashboardHeaderState({
      currentGuildData: {
        name: 'Builders',
        motd: ' Welcome ',
        description: 'We ship',
        image_url: '/uploads/guild.png',
      },
      guildImgFailed: false,
      getFileUrlFn: (value) => `https://cdn.guild.test${value}`,
    }),
    {
      guildName: 'Builders',
      guildMotd: 'Welcome',
      guildDescription: 'We ship',
      guildImage: '/uploads/guild.png',
      guildImageUrl: 'https://cdn.guild.test/uploads/guild.png',
    }
  );

  assert.equal(
    buildGuildDashboardHeaderState({
      currentGuildData: { image_url: '/uploads/guild.png' },
      guildImgFailed: true,
      getFileUrlFn: (value) => value,
    }).guildImageUrl,
    null
  );
});
