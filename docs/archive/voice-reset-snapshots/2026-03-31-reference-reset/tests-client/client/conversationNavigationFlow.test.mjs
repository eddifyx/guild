import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyConversationName,
  applyConversationState,
  areConversationsEqual,
  createConversationSelectionActions,
} from '../../../client/src/features/messaging/conversationNavigationFlow.mjs';

test('conversation navigation equality helpers preserve referential stability for unchanged routes', () => {
  const previousConversation = { type: 'dm', id: 'user-1', npub: 'npub1user', collapsing: false };
  const nextConversation = { type: 'dm', id: 'user-1', npub: 'npub1user', collapsing: false };

  assert.equal(areConversationsEqual(previousConversation, nextConversation), true);
  assert.equal(applyConversationState(previousConversation, nextConversation), previousConversation);
  assert.equal(applyConversationName('Builder', 'Builder'), 'Builder');
  assert.equal(applyConversationName('Builder', 'Scout'), 'Scout');
});

test('conversation selection actions shape room and dm navigation consistently', () => {
  const traces = [];
  const emitted = [];
  const stateChanges = [];
  const clearedRoomUnread = [];
  const clearedDmUnread = [];

  const actions = createConversationSelectionActions({
    clearConversationPerfTrace: (reason) => traces.push(['clear', reason]),
    setConversationState: (conversation, conversationName) => stateChanges.push([conversation, conversationName]),
    setConversationPerfTrace: (traceId) => traces.push(['trace', traceId]),
    clearUnreadRoom: (roomId) => clearedRoomUnread.push(roomId),
    clearUnread: (userId) => clearedDmUnread.push(userId),
    socket: {
      emit(eventName, payload) {
        emitted.push([eventName, payload]);
      },
    },
    startTrace: (eventName, payload) => `${eventName}:${payload.conversationType}:${payload.conversationId}`,
  });

  actions.handleSelectRoom({ id: 'room-2', name: 'war-room' });
  actions.handleSelectDM({
    other_user_id: 'user-9',
    other_username: 'Scout',
    other_npub: 'npub1scout',
  });

  assert.deepEqual(traces, [
    ['trace', 'conversation-open:room:room-2'],
    ['trace', 'conversation-open:dm:user-9'],
  ]);
  assert.deepEqual(emitted, [['room:join', { roomId: 'room-2' }]]);
  assert.deepEqual(stateChanges, [
    [{ type: 'room', id: 'room-2' }, 'war-room'],
    [{ type: 'dm', id: 'user-9', npub: 'npub1scout' }, 'Scout'],
  ]);
  assert.deepEqual(clearedRoomUnread, ['room-2']);
  assert.deepEqual(clearedDmUnread, ['user-9']);
});

test('conversation selection actions handle utility routes and guild chat focus states', () => {
  const stateChanges = [];
  const expandedStates = [];
  const actions = createConversationSelectionActions({
    clearConversationPerfTrace: () => {},
    setConversationState: (conversation, conversationName) => stateChanges.push([conversation, conversationName]),
    setConversationPerfTrace: () => {},
    user: { username: 'Builder' },
    setGuildChatExpanded: (expanded) => expandedStates.push(expanded),
    clearGuildChatUnreadMentions: () => stateChanges.push(['clear-unread']),
    queueGuildChatComposerFocus: () => stateChanges.push(['focus']),
  });

  assert.equal(actions.handleSelectAssetDump(), 'assets');
  assert.equal(actions.handleSelectAddons(), 'addons');
  assert.equal(actions.handleSelectStream('user-3', 'Scout'), 'user-3');
  assert.equal(actions.handleSelectNostrProfile(), 'nostr-profile');
  assert.equal(actions.handleSelectVoiceChannel('voice-1', 'War Room'), 'voice-1');
  assert.equal(actions.handleSelectGuildChatHome(), 'guildchat-home');
  assert.equal(actions.handleSelectGuildChatFull(), 'guildchat-full');
  assert.equal(actions.handleCollapseGuildChatFull({ hasConversation: false }), 'collapsed-home');

  assert.deepEqual(stateChanges, [
    [{ type: 'assets', id: 'dump' }, 'Asset Dumping Grounds'],
    [{ type: 'addons', id: 'addons' }, 'Addons'],
    [{ type: 'stream', id: 'user-3' }, "Scout's Stream"],
    [{ type: 'nostr-profile' }, 'Builder'],
    [{ type: 'voice', id: 'voice-1' }, 'War Room'],
    ['clear-unread'],
    [null, ''],
    ['focus'],
    ['clear-unread'],
    ['focus'],
    ['focus'],
  ]);
  assert.deepEqual(expandedStates, [true, false]);
});

test('conversation selection actions clear room navigation when boards are disabled', () => {
  const traces = [];
  const stateChanges = [];
  const emitted = [];

  const actions = createConversationSelectionActions({
    boardsDisabled: true,
    clearConversationPerfTrace: (reason) => traces.push(reason),
    setConversationState: (conversation, conversationName) => stateChanges.push([conversation, conversationName]),
    socket: {
      emit(eventName, payload) {
        emitted.push([eventName, payload]);
      },
    },
  });

  assert.equal(actions.handleSelectRoom({ id: 'room-9', name: 'board' }), null);
  assert.deepEqual(traces, ['boards-disabled']);
  assert.deepEqual(stateChanges, [[null, '']]);
  assert.deepEqual(emitted, []);
});
