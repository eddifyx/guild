const test = require('node:test');
const assert = require('node:assert/strict');

const { createVoiceRepository } = require('../../../server/src/repositories/voiceRepository');

test('voice repository exposes channel persistence operations through the canonical SQL bindings', () => {
  const calls = [];
  const repository = createVoiceRepository({
    db: {
      prepare(sql) {
        return {
          run(...args) {
            calls.push({ sql, args });
            return { changes: 1 };
          },
          get(...args) {
            calls.push({ sql, args });
            return { id: 'voice-1', guild_id: 'guild-1' };
          },
          all(...args) {
            calls.push({ sql, args });
            return [{ id: 'voice-1' }];
          },
        };
      },
    },
  });

  repository.createVoiceChannel.run('voice-1', 'General', 'guild-1', 'user-1');
  repository.getVoiceChannelsByGuild.all('guild-1');
  repository.getVoiceChannelById.get('voice-1');
  repository.updateVoiceChannelName.run('Lobby', 'voice-1');
  repository.deleteVoiceChannel.run('voice-1');

  assert.deepEqual(calls.map((entry) => entry.args), [
    ['voice-1', 'General', 'guild-1', 'user-1'],
    ['guild-1'],
    ['voice-1'],
    ['Lobby', 'voice-1'],
    ['voice-1'],
  ]);
});

test('voice repository exposes session persistence operations for join, list, mute, and cleanup', () => {
  const calls = [];
  const repository = createVoiceRepository({
    db: {
      prepare(sql) {
        return {
          run(...args) {
            calls.push({ sql, args });
            return { changes: 1 };
          },
          get(...args) {
            calls.push({ sql, args });
            return { channel_id: 'voice-1', user_id: 'user-1' };
          },
          all(...args) {
            calls.push({ sql, args });
            return [{ user_id: 'user-1' }];
          },
        };
      },
    },
  });

  repository.addVoiceSession.run('voice-1', 'user-1');
  repository.getVoiceChannelParticipants.all('voice-1');
  repository.getUserVoiceSession.get('user-1');
  repository.updateVoiceMuteState.run(1, 0, 'voice-1', 'user-1');
  repository.clearChannelVoiceSessions.run('voice-1');
  repository.removeUserFromAllVoiceChannels.run('user-1');
  repository.clearAllVoiceSessions.run();

  assert.deepEqual(calls.map((entry) => entry.args), [
    ['voice-1', 'user-1'],
    ['voice-1'],
    ['user-1'],
    [1, 0, 'voice-1', 'user-1'],
    ['voice-1'],
    ['user-1'],
    [],
  ]);
});
