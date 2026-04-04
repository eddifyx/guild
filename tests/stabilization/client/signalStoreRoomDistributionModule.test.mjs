import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('signal store implementations delegate room distribution ownership to the shared helper module', async () => {
  const sqliteSource = await readFile(
    new URL('../../../client/electron/crypto/signalStore.js', import.meta.url),
    'utf8'
  );
  const memorySource = await readFile(
    new URL('../../../client/electron/crypto/signalStoreMemory.js', import.meta.url),
    'utf8'
  );
  const roomDistributionSource = await readFile(
    new URL('../../../client/electron/crypto/signalStoreRoomDistribution.js', import.meta.url),
    'utf8'
  );

  assert.match(sqliteSource, /require\('\.\/signalStoreRoomDistribution'\)/);
  assert.match(memorySource, /require\('\.\/signalStoreRoomDistribution'\)/);
  assert.doesNotMatch(sqliteSource, /class RoomDistributionMap/);
  assert.doesNotMatch(memorySource, /class RoomDistributionMap/);
  assert.match(roomDistributionSource, /class SQLiteRoomDistributionMap/);
  assert.match(roomDistributionSource, /class MemoryRoomDistributionMap/);
});
