import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('electron message cache runtime delegates model helpers through the dedicated persistence runtime', async () => {
  const runtimeSource = await readFile(
    new URL('../../../client/electron/messageCacheRuntime.js', import.meta.url),
    'utf8'
  );
  const persistenceSource = await readFile(
    new URL('../../../client/electron/messageCachePersistenceRuntime.js', import.meta.url),
    'utf8'
  );
  const stateRuntimeSource = await readFile(
    new URL('../../../client/electron/messageCachePersistenceStateRuntime.js', import.meta.url),
    'utf8'
  );
  const modelSource = await readFile(
    new URL('../../../client/electron/messageCacheModel.js', import.meta.url),
    'utf8'
  );

  assert.match(runtimeSource, /require\('\.\/messageCachePersistenceRuntime'\)/);
  assert.doesNotMatch(runtimeSource, /function encodeMessageCacheSegment\(/);
  assert.doesNotMatch(runtimeSource, /function getMessageCacheDir\(/);
  assert.doesNotMatch(runtimeSource, /function getMessageCacheFilePath\(/);
  assert.doesNotMatch(runtimeSource, /function pruneMessageCacheEntries\(/);
  assert.doesNotMatch(runtimeSource, /function serializeMessageCache\(/);
  assert.doesNotMatch(runtimeSource, /function deserializeMessageCache\(/);
  assert.doesNotMatch(runtimeSource, /function normalizeMessageCacheEntry\(/);
  assert.match(persistenceSource, /require\('\.\/messageCachePersistenceStateRuntime'\)/);
  assert.doesNotMatch(persistenceSource, /function encodeMessageCacheSegment\(/);
  assert.doesNotMatch(persistenceSource, /function getMessageCacheDir\(/);
  assert.doesNotMatch(persistenceSource, /function getMessageCacheFilePath\(/);
  assert.doesNotMatch(persistenceSource, /function pruneMessageCacheEntries\(/);
  assert.doesNotMatch(persistenceSource, /function serializeMessageCache\(/);
  assert.doesNotMatch(persistenceSource, /function deserializeMessageCache\(/);
  assert.doesNotMatch(persistenceSource, /function normalizeMessageCacheEntry\(/);
  assert.match(stateRuntimeSource, /require\('\.\/messageCacheModel'\)/);
  assert.doesNotMatch(stateRuntimeSource, /function encodeMessageCacheSegment\(/);
  assert.doesNotMatch(stateRuntimeSource, /function getMessageCacheDir\(/);
  assert.doesNotMatch(stateRuntimeSource, /function getMessageCacheFilePath\(/);
  assert.doesNotMatch(stateRuntimeSource, /function pruneMessageCacheEntries\(/);
  assert.doesNotMatch(stateRuntimeSource, /function serializeMessageCache\(/);
  assert.doesNotMatch(stateRuntimeSource, /function deserializeMessageCache\(/);
  assert.doesNotMatch(stateRuntimeSource, /function normalizeMessageCacheEntry\(/);
  assert.match(modelSource, /function encodeMessageCacheSegment\(/);
  assert.match(modelSource, /function getMessageCacheDir\(/);
  assert.match(modelSource, /function getMessageCacheFilePath\(/);
  assert.match(modelSource, /function pruneMessageCacheEntries\(/);
  assert.match(modelSource, /function serializeMessageCache\(/);
  assert.match(modelSource, /function deserializeMessageCache\(/);
  assert.match(modelSource, /function normalizeMessageCacheEntry\(/);
});
