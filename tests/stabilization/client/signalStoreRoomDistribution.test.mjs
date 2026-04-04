import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  createMemoryRoomDistributionMap,
  createSQLiteRoomDistributionMap,
} = require('../../../client/electron/crypto/signalStoreRoomDistribution.js');

function createFakeRoomDistributionDb() {
  const rows = new Map();
  return {
    rows,
    prepare(sql) {
      if (sql.includes('INSERT OR REPLACE INTO room_distribution')) {
        return {
          run(roomId, distributionId) {
            rows.set(roomId, distributionId);
          },
        };
      }
      if (sql.includes('SELECT distribution_id FROM room_distribution')) {
        return {
          get(roomId) {
            const distributionId = rows.get(roomId);
            return distributionId ? { distribution_id: distributionId } : undefined;
          },
        };
      }
      if (sql.includes('DELETE FROM room_distribution')) {
        return {
          run(roomId) {
            rows.delete(roomId);
          },
        };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
}

function createUuidRef(values) {
  const queue = [...values];
  return {
    randomUUID() {
      return queue.shift();
    },
  };
}

test('signal store room distribution owners keep get-or-create and reset behavior stable for sqlite and memory stores', () => {
  const sqliteDb = createFakeRoomDistributionDb();
  const sqliteMap = createSQLiteRoomDistributionMap({
    db: sqliteDb,
    cryptoRef: createUuidRef(['sqlite-1', 'sqlite-2']),
  });
  const memoryMap = createMemoryRoomDistributionMap({
    cryptoRef: createUuidRef(['memory-1', 'memory-2']),
  });

  assert.equal(sqliteMap.getOrCreate('room-a'), 'sqlite-1');
  assert.equal(sqliteMap.getOrCreate('room-a'), 'sqlite-1');
  assert.equal(sqliteMap.get('room-a'), 'sqlite-1');
  assert.equal(sqliteMap.reset('room-a'), 'sqlite-2');
  assert.equal(sqliteMap.get('room-a'), 'sqlite-2');

  assert.equal(memoryMap.getOrCreate('room-b'), 'memory-1');
  assert.equal(memoryMap.getOrCreate('room-b'), 'memory-1');
  assert.equal(memoryMap.get('room-b'), 'memory-1');
  assert.equal(memoryMap.reset('room-b'), 'memory-2');
  assert.equal(memoryMap.get('room-b'), 'memory-2');
});

test('signal store room distribution owners return null for missing rooms', () => {
  const sqliteDb = createFakeRoomDistributionDb();
  const sqliteMap = createSQLiteRoomDistributionMap({
    db: sqliteDb,
    cryptoRef: createUuidRef(['sqlite-1']),
  });
  const memoryMap = createMemoryRoomDistributionMap({
    cryptoRef: createUuidRef(['memory-1']),
  });

  assert.equal(sqliteMap.get('missing-room'), null);
  assert.equal(memoryMap.get('missing-room'), null);
});
