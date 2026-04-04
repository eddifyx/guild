import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GUILD_DASHBOARD_MEMBER_LIMIT,
  GUILD_DASHBOARD_TAVERN_MEMBER_PREVIEW_LIMIT,
  GUILD_DASHBOARD_STATUS_MAX_LENGTH,
  buildGuildDashboardRosterState,
  buildGuildDashboardStatusPopover,
  enrichGuildDashboardMembers,
  formatGuildDashboardLastSeen,
} from '../../../client/src/features/guild/guildDashboardModel.mjs';

test('guild dashboard model enriches members with online metadata and rank ordering', () => {
  const members = [
    { id: 'b', username: 'Beta', rankOrder: 5, profilePicture: null },
    { id: 'a', username: 'Alpha', rankOrder: 2, profilePicture: 'stored.png' },
    { id: 'c', username: 'Gamma', rankOrder: 1, profilePicture: null },
  ];
  const onlineUsers = [
    { userId: 'b', customStatus: 'Ready', profilePicture: 'live.png' },
  ];
  const onlineIds = new Set(['b']);

  const enriched = enrichGuildDashboardMembers({ members, onlineUsers, onlineIds });

  assert.deepEqual(
    enriched.map((member) => ({
      id: member.id,
      isOnline: member.isOnline,
      customStatus: member.customStatus,
      profilePicture: member.profilePicture,
    })),
    [
      { id: 'b', isOnline: true, customStatus: 'Ready', profilePicture: 'live.png' },
      { id: 'c', isOnline: false, customStatus: '', profilePicture: null },
      { id: 'a', isOnline: false, customStatus: '', profilePicture: 'stored.png' },
    ],
  );
});

test('guild dashboard model derives preview and expanded roster state consistently', () => {
  const members = Array.from({ length: 10 }, (_, index) => ({
    id: String(index),
    isOnline: index < 6,
  }));

  const previewState = buildGuildDashboardRosterState({
    members,
    showOffline: false,
    showExpandedRoster: false,
  });
  const expandedState = buildGuildDashboardRosterState({
    members,
    showOffline: true,
    showExpandedRoster: true,
  });

  assert.equal(previewState.onlineCount, 6);
  assert.equal(previewState.visibleMembers.length, 6);
  assert.equal(previewState.hasMore, false);
  assert.equal(expandedState.visibleMembers.length, members.length);
  assert.equal(expandedState.totalMemberCount, members.length);
  assert.equal(expandedState.memberPool.length, members.length);
  assert.equal(GUILD_DASHBOARD_TAVERN_MEMBER_PREVIEW_LIMIT, 8);
  assert.equal(GUILD_DASHBOARD_MEMBER_LIMIT, 50);
});

test('guild dashboard model formats last seen timestamps and shapes status popovers', () => {
  const now = new Date('2026-03-25T12:00:00Z').getTime();

  assert.equal(formatGuildDashboardLastSeen(null, now), 'Never');
  assert.equal(formatGuildDashboardLastSeen('2026-03-25T11:59:40Z', now), 'Just now');
  assert.equal(formatGuildDashboardLastSeen('2026-03-25T11:20:00Z', now), '40m ago');
  assert.equal(formatGuildDashboardLastSeen('2026-03-25T09:00:00Z', now), '3h ago');
  assert.equal(formatGuildDashboardLastSeen('2026-03-20T12:00:00Z', now), '5d ago');

  assert.deepEqual(
    buildGuildDashboardStatusPopover({
      member: { id: 'user-1', username: 'Alice', customStatus: '  Ready to raid  ' },
      rect: { left: 10, bottom: 20, top: 5 },
      currentUserId: 'user-2',
    }),
    {
      username: 'Alice',
      status: 'Ready to raid',
      position: { x: 10, y: 20, top: 5 },
    },
  );

  assert.equal(
    buildGuildDashboardStatusPopover({
      member: { id: 'user-1', username: 'Alice', customStatus: '   ' },
      rect: { left: 10, bottom: 20, top: 5 },
      currentUserId: 'user-1',
    }),
    null,
  );
  assert.equal(GUILD_DASHBOARD_STATUS_MAX_LENGTH, 128);
});
