import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMainLayoutAlertsState,
  buildMainLayoutContentShellState,
  buildMainLayoutPipState,
  buildMainLayoutTitleBarState,
  buildMainLayoutVerifyIdentityState,
} from '../../../client/src/features/layout/mainLayoutControllerModel.mjs';

test('main layout controller model exposes alert state and verify-identity gating consistently', () => {
  const alerts = buildMainLayoutAlertsState({
    insecureConnection: true,
    e2eWarning: true,
    versionToast: { message: 'updated' },
    showUpdateOverlay: true,
    latestVersionInfo: { version: '1.0.70' },
    serverUrl: 'https://guild.app',
  });
  assert.equal(alerts.insecureConnection, true);
  assert.equal(alerts.e2eWarning, true);
  assert.equal(alerts.serverUrl, 'https://guild.app');

  assert.equal(buildMainLayoutVerifyIdentityState({
    showVerifyIdentity: true,
    conversationType: 'room',
    conversationId: 'room-1',
  }), null);

  const verifyIdentityState = buildMainLayoutVerifyIdentityState({
    showVerifyIdentity: true,
    conversationType: 'dm',
    conversationId: 'user-1',
    conversationName: 'edd',
    onClose: () => {},
    onVerified: () => {},
  });
  assert.deepEqual(
    { userId: verifyIdentityState.userId, username: verifyIdentityState.username },
    { userId: 'user-1', username: 'edd' },
  );
});

test('main layout controller model builds title bar, pip, and content shell passthrough state', () => {
  const calls = [];
  const windowObj = {
    electronAPI: {
      windowMinimize: () => calls.push('min'),
      windowMaximize: () => calls.push('max'),
      windowClose: () => calls.push('close'),
    },
  };

  const titleBar = buildMainLayoutTitleBarState({
    headerState: { title: 'Guild' },
    updateButtonState: { visible: true },
    onRequestVerifyIdentity: () => calls.push('verify'),
    onUpdateButtonClick: () => calls.push('update'),
    windowObj,
  });

  titleBar.onRequestVerifyIdentity();
  titleBar.onUpdateButtonClick();
  titleBar.onWindowMinimize();
  titleBar.onWindowMaximize();
  titleBar.onWindowClose();

  assert.deepEqual(calls, ['verify', 'update', 'min', 'max', 'close']);

  const pipState = buildMainLayoutPipState({
    showPiP: true,
    conversationType: 'stream',
    onNavigate: () => {},
    onClose: () => {},
  });
  assert.equal(pipState.showPiP, true);
  assert.equal(pipState.conversationType, 'stream');

  const contentShell = buildMainLayoutContentShellState({
    rooms: ['room-1'],
    myRooms: ['room-1'],
    conversation: { type: 'room', id: 'room-1' },
    guildChatAvailable: true,
    guildChatCompact: false,
  });
  assert.deepEqual(contentShell.rooms, ['room-1']);
  assert.equal(contentShell.guildChatAvailable, true);
  assert.equal(contentShell.guildChatCompact, false);
});
