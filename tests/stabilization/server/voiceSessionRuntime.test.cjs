const test = require('node:test');
const assert = require('node:assert/strict');

const { createVoiceSessionRuntime } = require('../../../server/src/domain/voice/voiceSessionRuntime');

function createRuntimeHarness() {
  const calls = [];
  const users = new Map([
    ['user-1', { username: 'Builder', avatar_color: '#40FF40', npub: 'npub1builder' }],
    ['user-2', { username: 'Scout', avatar_color: '#55AAFF', npub: null }],
  ]);

  const runtime = createVoiceSessionRuntime({
    addVoiceSession: { run: (...args) => calls.push(['addVoiceSession', ...args]) },
    clearChannelVoiceSessions: { run: (...args) => calls.push(['clearChannelVoiceSessions', ...args]) },
    removeUserFromAllVoiceChannels: { run: (...args) => calls.push(['removeUserFromAllVoiceChannels', ...args]) },
    getUserVoiceSession: { get: () => null },
    getUserById: { get: (id) => users.get(id) || null },
    updateVoiceMuteState: { run: (...args) => calls.push(['updateVoiceMuteState', ...args]) },
    getVoiceChannelById: { get: (channelId) => ({ id: channelId, guild_id: 'guild-1' }) },
    getGuildMembers: { all: () => [{ id: 'user-1' }, { id: 'user-2' }] },
    runtimeMetrics: {
      recordVoiceLeave: (payload) => calls.push(['recordVoiceLeave', payload]),
      recordVoiceError: (event, payload) => calls.push(['recordVoiceError', event, payload]),
    },
    msManager: {
      removePeer: (...args) => calls.push(['removePeer', ...args]),
      removeRoom: (...args) => calls.push(['removeRoom', ...args]),
    },
  });

  const io = {
    emitted: [],
    to(room) {
      return {
        emit: (event, payload) => {
          io.emitted.push([room, event, payload]);
        },
      };
    },
    in(room) {
      return {
        socketsLeave: (target) => {
          io.emitted.push([room, 'socketsLeave', target]);
        },
      };
    },
  };

  const socket = {
    joined: [],
    left: [],
    join(room) {
      this.joined.push(room);
    },
    leave(room) {
      this.left.push(room);
    },
  };

  return { runtime, calls, io, socket };
}

test('voice session runtime joins users and builds channel updates from live state', () => {
  const { runtime, calls, io, socket } = createRuntimeHarness();

  const participants = runtime.markUserJoinedChannel(io, socket, 'voice-1', 'user-1');

  assert.deepEqual(participants, [{
    userId: 'user-1',
    username: 'Builder',
    avatarColor: '#40FF40',
    npub: 'npub1builder',
    muted: false,
    deafened: false,
    speaking: false,
    screenSharing: false,
  }]);
  assert.deepEqual(socket.joined, ['voice:voice-1']);
  assert.deepEqual(calls.slice(0, 2), [
    ['removeUserFromAllVoiceChannels', 'user-1'],
    ['addVoiceSession', 'voice-1', 'user-1'],
  ]);
  assert.equal(runtime.hasLiveVoiceSession('voice-1', 'user-1'), true);
  assert.deepEqual(runtime.getLiveChannelParticipants('voice-1'), participants);
});

test('voice session runtime mute and deafen updates preserve persisted state shape', () => {
  const { runtime, calls, io, socket } = createRuntimeHarness();
  runtime.markUserJoinedChannel(io, socket, 'voice-1', 'user-1');

  assert.deepEqual(runtime.updateMuteState('voice-1', 'user-1', true), {
    channelId: 'voice-1',
    userId: 'user-1',
    muted: true,
    deafened: false,
  });
  assert.deepEqual(runtime.updateDeafenState('voice-1', 'user-1', true), {
    channelId: 'voice-1',
    userId: 'user-1',
    muted: true,
    deafened: true,
  });

  assert.deepEqual(calls.filter(([name]) => name === 'updateVoiceMuteState'), [
    ['updateVoiceMuteState', 1, 0, 'voice-1', 'user-1'],
    ['updateVoiceMuteState', 1, 1, 'voice-1', 'user-1'],
  ]);
});

test('voice session runtime cleanup removes every live session for a user', async () => {
  const { runtime, calls, io, socket } = createRuntimeHarness();
  runtime.markUserJoinedChannel(io, socket, 'voice-1', 'user-1');
  runtime.markUserJoinedChannel(io, socket, 'voice-2', 'user-1');

  const cleaned = await runtime.cleanupUserVoiceSessions(io, socket, 'user-1', 'voice-2');

  assert.equal(cleaned, true);
  assert.equal(runtime.getUserLiveVoiceChannelIds('user-1').length, 0);
  assert.deepEqual(socket.left, ['voice:voice-1', 'voice:voice-2']);
  assert.deepEqual(calls.filter(([name]) => name === 'recordVoiceLeave'), [
    ['recordVoiceLeave', { channelId: 'voice-1', userId: 'user-1' }],
    ['recordVoiceLeave', { channelId: 'voice-2', userId: 'user-1' }],
  ]);
});

test('voice session runtime destroy tears down channel members and mediasoup room', () => {
  const { runtime, calls, io, socket } = createRuntimeHarness();
  runtime.markUserJoinedChannel(io, socket, 'voice-1', 'user-1');
  runtime.markUserJoinedChannel(io, socket, 'voice-1', 'user-2');

  runtime.destroyLiveVoiceChannel(io, 'voice-1', 'room-reset');

  assert.equal(runtime.getLiveChannelParticipants('voice-1'), null);
  assert.deepEqual(calls.filter(([name]) => name === 'recordVoiceLeave'), [
    ['recordVoiceLeave', { channelId: 'voice-1', userId: 'user-1', reason: 'room-reset' }],
    ['recordVoiceLeave', { channelId: 'voice-1', userId: 'user-2', reason: 'room-reset' }],
  ]);
  assert.deepEqual(calls.filter(([name]) => name === 'removeRoom'), [
    ['removeRoom', 'voice-1'],
  ]);
});
