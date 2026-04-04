import test from 'node:test';
import assert from 'node:assert/strict';

import {
  syncActiveStreamConversationState,
  syncJoinedVoiceConversationState,
  syncPiPVisibilityState,
  syncScreenShareConversationState,
} from '../../../client/src/features/layout/layoutConversationRuntime.mjs';

test('layout conversation runtime moves into and out of own stream view around screen sharing', () => {
  const prevConversationRef = { current: undefined };
  const prevConversationNameRef = { current: undefined };
  const conversations = [];
  const names = [];

  const started = syncScreenShareConversationState({
    screenSharing: true,
    conversation: { type: 'room', id: 'room-1' },
    conversationName: 'Room 1',
    userId: 'user-a',
    username: 'Alice',
    prevConversationRef,
    prevConversationNameRef,
    setConversationFn: (value) => conversations.push(value),
    setConversationNameFn: (value) => names.push(value),
  });

  assert.equal(started, 'started');
  assert.deepEqual(conversations.at(-1), { type: 'stream', id: 'user-a' });
  assert.equal(names.at(-1), "Alice's Stream");

  const restored = syncScreenShareConversationState({
    screenSharing: false,
    prevConversationRef,
    prevConversationNameRef,
    setConversationFn: (value) => conversations.push(value),
    setConversationNameFn: (value) => names.push(value),
  });

  assert.equal(restored, 'restored');
  assert.deepEqual(conversations.at(-1), { type: 'room', id: 'room-1' });
  assert.equal(names.at(-1), 'Room 1');
});

test('layout conversation runtime promotes and demotes active voice conversations around remote streams', () => {
  const conversations = [];
  const names = [];

  const promoted = syncActiveStreamConversationState({
    screenSharing: false,
    channelId: 'voice-1',
    activeVoiceChannel: { id: 'voice-1', name: 'Voice 1' },
    activeRemoteStreamer: { userId: 'user-b', username: 'Bob' },
    streamConversationMatchesActiveVoice: false,
    conversationType: 'voice',
    conversationId: 'voice-1',
    setConversationFn: (value) => conversations.push(value),
    setConversationNameFn: (value) => names.push(value),
  });

  assert.equal(promoted, 'promoted-to-stream');
  assert.deepEqual(conversations.at(-1), { type: 'stream', id: 'user-b' });

  const demoted = syncActiveStreamConversationState({
    screenSharing: false,
    channelId: 'voice-1',
    activeVoiceChannel: { id: 'voice-1', name: 'Voice 1' },
    activeRemoteStreamer: null,
    streamConversationMatchesActiveVoice: true,
    conversationType: 'stream',
    conversationId: 'user-b',
    setConversationFn: (value) => conversations.push(value),
    setConversationNameFn: (value) => names.push(value),
  });

  assert.equal(demoted, 'demoted-to-voice');
  assert.deepEqual(conversations.at(-1), { type: 'voice', id: 'voice-1' });
  assert.equal(names.at(-1), 'Voice 1');
});

test('layout conversation runtime toggles PiP visibility only when an active stream exists', () => {
  const prevConversationTypeRef = { current: 'stream' };
  const values = [];

  const shown = syncPiPVisibilityState({
    conversationType: 'room',
    screenSharing: false,
    channelId: 'voice-1',
    voiceChannels: [{ id: 'voice-1', participants: [{ screenSharing: true }] }],
    prevConversationTypeRef,
    setShowPiPFn: (value) => values.push(value),
  });
  assert.equal(shown, 'show');
  assert.equal(values.at(-1), true);

  const hidden = syncPiPVisibilityState({
    conversationType: 'stream',
    screenSharing: false,
    channelId: 'voice-1',
    voiceChannels: [],
    prevConversationTypeRef,
    setShowPiPFn: (value) => values.push(value),
  });
  assert.equal(hidden, 'hide');
  assert.equal(values.at(-1), false);
});

test('layout conversation runtime updates selection on joined and cleared voice channels', () => {
  const prevJoinedVoiceChannelIdRef = { current: null };
  const conversations = [];
  const names = [];

  const joined = syncJoinedVoiceConversationState({
    channelId: 'voice-1',
    activeVoiceChannel: { id: 'voice-1', name: 'Voice 1' },
    activeRemoteStreamer: null,
    screenSharing: false,
    conversationType: 'room',
    prevJoinedVoiceChannelIdRef,
    setConversationFn: (value) => conversations.push(value),
    setConversationNameFn: (value) => names.push(value),
  });

  assert.equal(joined, 'joined-voice');
  assert.deepEqual(conversations.at(-1), { type: 'voice', id: 'voice-1' });

  const cleared = syncJoinedVoiceConversationState({
    channelId: null,
    conversationType: 'voice',
    prevJoinedVoiceChannelIdRef,
    setConversationFn: (value) => conversations.push(value),
    setConversationNameFn: (value) => names.push(value),
  });

  assert.equal(cleared, 'cleared');
  assert.equal(conversations.at(-1), null);
  assert.equal(names.at(-1), '');
});
