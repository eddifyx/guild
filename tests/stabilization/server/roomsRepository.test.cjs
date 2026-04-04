const test = require('node:test');
const assert = require('node:assert/strict');

const { createRoomsRepository } = require('../../../server/src/repositories/roomsRepository');

test('rooms repository exposes canonical room persistence operations', () => {
  const calls = [];
  const repository = createRoomsRepository({
    db: {
      prepare(sql) {
        return {
          run(...args) {
            calls.push({ sql, args });
            return { changes: 1 };
          },
          get(...args) {
            calls.push({ sql, args });
            return { id: 'room-1', guild_id: 'guild-1' };
          },
          all(...args) {
            calls.push({ sql, args });
            return [{ id: 'room-1' }];
          },
        };
      },
      transaction(fn) {
        return (...args) => fn(...args);
      },
    },
  });

  repository.createRoom.run('room-1', 'General', 'guild-1', 'user-1');
  repository.getRoomsByGuild.all('guild-1');
  repository.getRoomById.get('room-1');
  repository.renameRoom.run('Lobby', 'room-1');
  repository.deleteRoomAttachments.run('room-1');
  repository.deleteRoomMessages.run('room-1');
  repository.deleteRoomMembers.run('room-1');
  repository.deleteRoomRow.run('room-1');

  assert.deepEqual(calls.map((entry) => entry.args), [
    ['room-1', 'General', 'guild-1', 'user-1'],
    ['guild-1'],
    ['room-1'],
    ['Lobby', 'room-1'],
    ['room-1'],
    ['room-1'],
    ['room-1'],
    ['room-1'],
  ]);
});

test('rooms repository fans users into and out of all guild rooms transactionally', () => {
  const membershipAdds = [];
  const membershipRemoves = [];
  const repository = createRoomsRepository({
    db: {
      prepare(sql) {
        return {
          run(...args) {
            if (sql.includes('INSERT OR IGNORE INTO room_members')) membershipAdds.push(args);
            if (sql.includes('DELETE FROM room_members')) membershipRemoves.push(args);
            return { changes: 1 };
          },
          get() {
            return null;
          },
          all(...args) {
            assert.deepEqual(args, ['guild-1']);
            return [{ id: 'room-1' }, { id: 'room-2' }];
          },
        };
      },
      transaction(fn) {
        return (...args) => fn(...args);
      },
    },
  });

  repository.addUserToGuildRooms('guild-1', 'user-1');
  repository.removeUserFromGuildRooms('guild-1', 'user-1');

  assert.deepEqual(membershipAdds, [
    ['room-1', 'user-1'],
    ['room-2', 'user-1'],
  ]);
  assert.deepEqual(membershipRemoves, [
    ['room-1', 'user-1'],
    ['room-2', 'user-1'],
  ]);
});
