import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('persisted message cache persistence runtime delegates pure helpers to the shared persisted message cache model', async () => {
  const persistenceSource = await readFile(
    new URL('../../../client/electron/persistedMessageCachePersistenceRuntime.js', import.meta.url),
    'utf8'
  );
  const loadSource = await readFile(
    new URL('../../../client/electron/persistedMessageCacheLoadRuntime.js', import.meta.url),
    'utf8'
  );
  const flushSource = await readFile(
    new URL('../../../client/electron/persistedMessageCacheFlushRuntime.js', import.meta.url),
    'utf8'
  );
  const modelSource = await readFile(
    new URL('../../../client/electron/persistedMessageCacheModel.js', import.meta.url),
    'utf8'
  );

  assert.match(persistenceSource, /require\('\.\/persistedMessageCacheModel'\)/);
  assert.match(loadSource, /require\('\.\/persistedMessageCacheModel'\)/);
  assert.match(flushSource, /require\('\.\/persistedMessageCacheModel'\)/);
  assert.doesNotMatch(persistenceSource, /function encodePersistenceSegment\(/);
  assert.doesNotMatch(persistenceSource, /function getMessageCacheDir\(/);
  assert.doesNotMatch(persistenceSource, /function getMessageCacheFilePath\(/);
  assert.doesNotMatch(persistenceSource, /function pruneMessageCacheEntries\(/);
  assert.doesNotMatch(persistenceSource, /function serializeMessageCache\(/);
  assert.doesNotMatch(persistenceSource, /function deserializeMessageCache\(/);
  assert.match(modelSource, /function encodePersistenceSegment\(/);
  assert.match(modelSource, /function getMessageCacheDir\(/);
  assert.match(modelSource, /function getMessageCacheFilePath\(/);
  assert.match(modelSource, /function pruneMessageCacheEntries\(/);
  assert.match(modelSource, /function serializeMessageCache\(/);
  assert.match(modelSource, /function deserializeMessageCache\(/);
});
