const test = require('node:test');
const assert = require('node:assert/strict');

const {
  runGuildCreateFlow,
  runGuildDisbandFlow,
  runGuildLeadershipTransferFlow,
  runGuildRankDeletionFlow,
} = require('../../../server/src/domain/guild/guildPersistenceFlow');

test('guild persistence flow creates a guild with default membership and channels', () => {
  const calls = [];
  const db = {
    transaction(fn) {
      return (...args) => fn(...args);
    },
  };

  runGuildCreateFlow({
    db,
    guildId: 'guild-1',
    inviteCode: 'invite-1',
    userId: 'user-1',
    createInput: {
      name: 'Guild',
      description: 'desc',
      imageUrl: '/uploads/guild.png',
      isPublic: true,
    },
    guildsToLeave: [{ id: 'guild-old' }],
    createIdFn: (() => {
      const ids = ['room-1', 'voice-1'];
      return () => ids.shift();
    })(),
    createGuild: { run: (...args) => calls.push(['createGuild', ...args]) },
    createGuildRank: { run: (...args) => calls.push(['createGuildRank', ...args]) },
    addGuildMember: { run: (...args) => calls.push(['addGuildMember', ...args]) },
    createRoom: { run: (...args) => calls.push(['createRoom', ...args]) },
    addRoomMember: { run: (...args) => calls.push(['addRoomMember', ...args]) },
    createVoiceChannel: { run: (...args) => calls.push(['createVoiceChannel', ...args]) },
    removeGuildMember: { run: (...args) => calls.push(['removeGuildMember', ...args]) },
    removeUserFromGuildRooms: (...args) => calls.push(['removeUserFromGuildRooms', ...args]),
  });

  assert.deepEqual(calls[0], ['removeGuildMember', 'guild-old', 'user-1']);
  assert.deepEqual(calls[1], ['removeUserFromGuildRooms', 'guild-old', 'user-1']);
  assert.deepEqual(calls[2], [
    'createGuild',
    'guild-1',
    'Guild',
    'desc',
    '/uploads/guild.png',
    '',
    '#40FF40',
    '#080a08',
    'user-1',
    1,
    'invite-1',
  ]);
  assert.equal(calls.some(([name]) => name === 'addGuildMember'), true);
  assert.equal(calls.some(([name, roomId]) => name === 'createRoom' && roomId === 'room-1'), true);
  assert.equal(calls.some(([name, channelId]) => name === 'createVoiceChannel' && channelId === 'voice-1'), true);
});

test('guild persistence flow disbands a guild and returns member and voice channel ids', () => {
  const calls = [];
  const db = {
    transaction(fn) {
      return (...args) => fn(...args);
    },
  };

  const result = runGuildDisbandFlow({
    db,
    guildId: 'guild-1',
    getGuildMembers: {
      all: () => [{ id: 'user-1' }, { id: 'user-2' }],
    },
    getRoomsByGuild: {
      all: () => [{ id: 'room-1' }],
    },
    getVoiceChannelsByGuild: {
      all: () => [{ id: 'voice-1' }],
    },
    deleteRoomAttachments: { run: (...args) => calls.push(['deleteRoomAttachments', ...args]) },
    deleteRoomMessages: { run: (...args) => calls.push(['deleteRoomMessages', ...args]) },
    deleteSenderKeyDistributionsForRoom: { run: (...args) => calls.push(['deleteSenderKeys', ...args]) },
    deleteRoomMembers: { run: (...args) => calls.push(['deleteRoomMembers', ...args]) },
    deleteRoomRow: { run: (...args) => calls.push(['deleteRoomRow', ...args]) },
    clearChannelVoiceSessions: { run: (...args) => calls.push(['clearChannelVoiceSessions', ...args]) },
    deleteVoiceChannel: { run: (...args) => calls.push(['deleteVoiceChannel', ...args]) },
    deleteGuildMembers: { run: (...args) => calls.push(['deleteGuildMembers', ...args]) },
    deleteGuildRanks: { run: (...args) => calls.push(['deleteGuildRanks', ...args]) },
    deleteGuildRow: { run: (...args) => calls.push(['deleteGuildRow', ...args]) },
  });

  assert.deepEqual(result, {
    memberIds: ['user-1', 'user-2'],
    voiceChannelIds: ['voice-1'],
  });
  assert.deepEqual(calls, [
    ['deleteRoomAttachments', 'room-1'],
    ['deleteRoomMessages', 'room-1'],
    ['deleteSenderKeys', 'room-1'],
    ['deleteRoomMembers', 'room-1'],
    ['deleteRoomRow', 'room-1'],
    ['clearChannelVoiceSessions', 'voice-1'],
    ['deleteVoiceChannel', 'voice-1'],
    ['deleteGuildMembers', 'guild-1'],
    ['deleteGuildRanks', 'guild-1'],
    ['deleteGuildRow', 'guild-1'],
  ]);
});

test('guild persistence flow applies leadership transfer and rank deletion through shared transactions', () => {
  const calls = [];
  const db = {
    transaction(fn) {
      return (...args) => fn(...args);
    },
    prepare(sql) {
      calls.push(['prepare', sql]);
      return {
        run: (...args) => calls.push(['reassignMembers', ...args]),
      };
    },
  };

  runGuildLeadershipTransferFlow({
    db,
    guildId: 'guild-1',
    actorUserId: 'user-1',
    newLeaderId: 'user-2',
    guildMasterRankId: 'rank-gm',
    demotedRankId: 'rank-officer',
    updateMemberRank: {
      run: (...args) => calls.push(['updateMemberRank', ...args]),
    },
  });

  runGuildRankDeletionFlow({
    db,
    guildId: 'guild-1',
    rankId: 'rank-old',
    reassignToRankId: 'rank-new',
    deleteGuildRank: {
      run: (...args) => calls.push(['deleteGuildRank', ...args]),
    },
  });

  assert.deepEqual(calls, [
    ['updateMemberRank', 'rank-gm', 'guild-1', 'user-2'],
    ['updateMemberRank', 'rank-officer', 'guild-1', 'user-1'],
    ['prepare', 'UPDATE guild_members SET rank_id = ? WHERE guild_id = ? AND rank_id = ?'],
    ['reassignMembers', 'rank-new', 'guild-1', 'rank-old'],
    ['deleteGuildRank', 'rank-old'],
  ]);
});
