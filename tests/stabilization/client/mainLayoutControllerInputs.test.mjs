import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMainLayoutControllerRuntimeInput,
  buildMainLayoutConversationEffectsInput,
  buildMainLayoutDerivedShellInput,
  buildMainLayoutDerivedVoiceInput,
  buildMainLayoutShellEffectsInput,
  buildMainLayoutViewInput,
} from '../../../client/src/features/layout/mainLayoutControllerInputs.mjs';

test('main layout controller inputs preserve canonical derived, runtime, effects, and view contracts', () => {
  const derivedVoiceInput = buildMainLayoutDerivedVoiceInput({
    screenSharing: { local: true },
    peers: { 'user-2': {} },
    channelId: 'voice-1',
    voiceChannels: [{ id: 'voice-1' }],
    conversation: { id: 'dm-1', type: 'dm' },
    currentUserId: 'user-1',
  });
  assert.equal(derivedVoiceInput.channelId, 'voice-1');
  assert.equal(derivedVoiceInput.currentUserId, 'user-1');

  const derivedShellInput = buildMainLayoutDerivedShellInput({
    currentGuild: 'guild-1',
    currentGuildData: { name: 'Guild One' },
    conversation: { type: 'dm' },
    conversationName: 'Friend',
    isOnline: true,
    e2eReady: true,
    appVersion: '1.2.3',
  });
  assert.equal(derivedShellInput.currentGuildName, 'Guild One');
  assert.equal(derivedShellInput.e2eReady, true);

  const runtimeInput = buildMainLayoutControllerRuntimeInput({
    conversation: { id: 'dm-1' },
    conversationName: 'Friend',
    latestVersionInfo: { version: '2.0.0' },
    updateAvailable: true,
    appVersion: '1.2.3',
  });
  assert.equal(runtimeInput.updateState.getConversation().id, 'dm-1');
  assert.equal(runtimeInput.updateState.getAppVersion(), '1.2.3');

  const conversationEffectsInput = buildMainLayoutConversationEffectsInput({
    user: { userId: 'user-1', username: 'alice' },
    conversation: { id: 'dm-1' },
  });
  assert.equal(conversationEffectsInput.userId, 'user-1');
  assert.equal(conversationEffectsInput.username, 'alice');

  const shellEffectsInput = buildMainLayoutShellEffectsInput({
    guildChatAvailable: true,
    guildChatExpanded: false,
  });
  assert.equal(shellEffectsInput.guildChatAvailable, true);

  const viewInput = buildMainLayoutViewInput({
    guildChat: { hasUnreadMention: true },
    conversation: { id: 'dm-1', type: 'dm' },
    conversationName: 'Friend',
    serverUrl: 'https://guild.test',
  });
  assert.equal(viewInput.guildChatHasUnreadMention, true);
  assert.equal(viewInput.conversationName, 'Friend');
  assert.equal(viewInput.serverUrl, 'https://guild.test');
});
