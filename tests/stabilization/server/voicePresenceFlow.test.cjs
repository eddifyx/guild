const test = require('node:test');
const assert = require('node:assert/strict');

const { createVoicePresenceFlow } = require('../../../server/src/domain/voice/voicePresenceFlow');

function createHarness() {
  const events = [];
  const errors = [];
  const invalid = [];
  const socketEvents = [];
  const socket = {
    to(room) {
      return {
        emit(event, payload) {
          socketEvents.push([room, event, payload]);
        },
      };
    },
  };
  const io = {
    to(room) {
      return {
        emit(event, payload) {
          events.push([room, event, payload]);
        },
      };
    },
  };

  const voiceRuntime = {
    hasLiveVoiceSession: () => true,
    updateMuteState: (_channelId, userId, muted) => ({ channelId: 'voice-1', userId, muted: !!muted, deafened: false }),
    updateDeafenState: (_channelId, userId, deafened) => ({ channelId: 'voice-1', userId, muted: true, deafened: !!deafened }),
    updateSpeakingState: (_channelId, userId, speaking) => ({ userId, speaking: !!speaking }),
    updateScreenShareState: () => true,
    emitChannelUpdate: (...args) => events.push(['channel-update', ...args]),
    getUserLiveVoiceChannelIds: () => ['voice-1'],
    cleanupUserVoiceSessions: async () => {
      events.push(['cleanup']);
    },
    getUserActiveVoiceChannelId: () => 'voice-1',
  };

  const flow = createVoicePresenceFlow({
    io,
    socket,
    userId: 'user-1',
    voiceRuntime,
    getUserVoiceSession: { get: () => ({ channel_id: 'voice-1' }) },
    msManager: {
      updateConsumerQuality: async () => {
        events.push(['quality']);
      },
    },
    runtimeMetrics: {
      recordVoiceError: (event, payload) => errors.push([event, payload]),
    },
    getVoiceSocketError: (_manager, _err, fallback) => fallback,
    rejectInvalidVoicePayload: (...args) => invalid.push(args),
    validateVoiceConsumerQualityPayload: (payload) => ({ ok: true, value: payload }),
    validateVoiceToggleMutePayload: (payload) => ({ ok: true, value: payload }),
    validateVoiceToggleDeafenPayload: (payload) => ({ ok: true, value: payload }),
    validateVoiceSpeakingPayload: (payload) => ({ ok: true, value: payload }),
    validateVoiceScreenShareStatePayload: (payload) => ({ ok: true, value: payload }),
    validateVoiceLeavePayload: (payload) => ({ ok: true, value: payload }),
  });

  return { flow, events, errors, invalid, socketEvents, voiceRuntime };
}

test('voice presence flow emits mute, deafen, and speaking updates through the correct channels', () => {
  const { flow, events, socketEvents } = createHarness();

  flow.handleToggleMute({ channelId: 'voice-1', muted: true });
  flow.handleToggleDeafen({ channelId: 'voice-1', deafened: true });
  flow.handleSpeaking({ channelId: 'voice-1', speaking: true });

  assert.deepEqual(events, [
    ['voice:voice-1', 'voice:peer-mute-update', { channelId: 'voice-1', userId: 'user-1', muted: true, deafened: false }],
    ['voice:voice-1', 'voice:peer-mute-update', { channelId: 'voice-1', userId: 'user-1', muted: true, deafened: true }],
  ]);
  assert.deepEqual(socketEvents, [
    ['voice:voice-1', 'voice:speaking', { userId: 'user-1', speaking: true }],
  ]);
});

test('voice presence flow delegates consumer quality updates asynchronously', async () => {
  const { flow, events } = createHarness();

  flow.handleConsumerQuality({
    channelId: 'voice-1',
    producerId: 'producer-1',
    score: 4,
  });
  await Promise.resolve();

  assert.deepEqual(events, [['quality']]);
});

test('voice presence flow emits channel refresh for screen share changes', () => {
  const { flow, events } = createHarness();

  flow.handleScreenShareState({ channelId: 'voice-1', sharing: true });

  assert.deepEqual(events, [['channel-update', { to: events.to }, 'voice-1']].map(() => events[0]));
});

test('voice presence flow leave rejects unknown channels and cleans up active ones', async () => {
  const { flow, events, voiceRuntime } = createHarness();
  voiceRuntime.getUserLiveVoiceChannelIds = () => [];
  const denied = [];
  await flow.handleLeave({ channelId: 'voice-2' }, (payload) => denied.push(payload));
  assert.deepEqual(denied, [{ ok: false, error: 'Not in this voice channel' }]);

  voiceRuntime.getUserLiveVoiceChannelIds = () => ['voice-1'];
  const allowed = [];
  await flow.handleLeave({ channelId: 'voice-1' }, (payload) => allowed.push(payload));
  assert.deepEqual(allowed, [{ ok: true }]);
  assert.deepEqual(events, [['cleanup']]);
});

test('voice presence flow disconnect cleanup is a no-op without an active channel', () => {
  const { flow, events, voiceRuntime } = createHarness();
  voiceRuntime.getUserActiveVoiceChannelId = () => null;

  flow.handleDisconnect();

  assert.deepEqual(events, []);
});
