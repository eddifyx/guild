import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSidebarAssetButtonState,
  buildSidebarOnlineUsersState,
  buildSidebarUserBarState,
} from '../../../client/src/features/layout/sidebarPanelsModel.mjs';

test('sidebar panels model shapes the user bar presence indicator from connection state', () => {
  assert.deepEqual(
    buildSidebarUserBarState({
      user: { username: 'Alice', avatarColor: '#40FF40', profilePicture: 'alice.png' },
      connected: true,
    }),
    {
      username: 'Alice',
      avatarColor: '#40FF40',
      profilePicture: 'alice.png',
      indicatorBackground: 'var(--success)',
      indicatorShadow: '0 0 6px rgba(0, 214, 143, 0.4)',
      notificationsMuted: false,
      notificationButtonTitle: 'Mute chat notifications',
      notificationButtonColor: 'var(--text-muted)',
      notificationButtonHoverColor: 'var(--text-secondary)',
      notificationButtonBackground: 'transparent',
      notificationButtonBorder: '1px solid transparent',
    }
  );
});

test('sidebar panels model exposes a clear muted notification toggle state', () => {
  assert.deepEqual(
    buildSidebarUserBarState({
      user: { username: 'Alice' },
      notificationsMuted: true,
    }),
    {
      username: 'Alice',
      avatarColor: undefined,
      profilePicture: null,
      indicatorBackground: 'var(--danger)',
      indicatorShadow: 'none',
      notificationsMuted: true,
      notificationButtonTitle: 'Unmute chat notifications',
      notificationButtonColor: 'var(--danger)',
      notificationButtonHoverColor: '#ff9b9b',
      notificationButtonBackground: 'rgba(255, 92, 92, 0.12)',
      notificationButtonBorder: '1px solid rgba(255, 92, 92, 0.28)',
    }
  );
});

test('sidebar panels model derives active and inactive asset button states', () => {
  assert.deepEqual(
    buildSidebarAssetButtonState({
      conversationType: 'assets',
      targetType: 'assets',
    }),
    {
      isActive: true,
      background: 'var(--bg-active)',
      color: 'var(--accent)',
      iconColor: 'var(--accent)',
      fontWeight: 500,
    }
  );

  assert.deepEqual(
    buildSidebarAssetButtonState({
      conversationType: 'room',
      targetType: 'addons',
    }),
    {
      isActive: false,
      background: 'transparent',
      color: 'var(--text-secondary)',
      iconColor: 'var(--text-muted)',
      fontWeight: 400,
    }
  );
});

test('sidebar panels model shapes online-user label, empty state, and current-user rows', () => {
  assert.deepEqual(
    buildSidebarOnlineUsersState({
      onlineUsers: [
        { userId: 'user-1', username: 'Alice' },
        { userId: 'user-2', username: 'Bob' },
      ],
      currentUserId: 'user-2',
    }),
    {
      label: 'Online — 2',
      isEmpty: false,
      rows: [
        { userId: 'user-1', username: 'Alice', isCurrentUser: false },
        { userId: 'user-2', username: 'Bob', isCurrentUser: true },
      ],
    }
  );
});
