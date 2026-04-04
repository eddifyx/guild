import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  createProtocolStoreWithFallback,
  shouldUseMemoryProtocolStoreFallback,
} = require('../../../client/electron/crypto/signalProtocolStoreFallback.js');

test('signal protocol store fallback only triggers for better-sqlite3 failures on Windows', () => {
  assert.equal(
    shouldUseMemoryProtocolStoreFallback(new Error('Cannot find module better-sqlite3'), { platform: 'win32' }),
    true
  );
  assert.equal(
    shouldUseMemoryProtocolStoreFallback(new Error('ordinary failure'), { platform: 'win32' }),
    false
  );
  assert.equal(
    shouldUseMemoryProtocolStoreFallback(new Error('Cannot find module better-sqlite3'), { platform: 'darwin' }),
    false
  );
});

test('signal protocol store fallback returns the primary store when creation succeeds', async () => {
  const result = await createProtocolStoreWithFallback({
    createPrimaryStore: async () => ({ mode: 'primary' }),
    createFallbackStore: async () => ({ mode: 'fallback' }),
  });

  assert.deepEqual(result, { mode: 'primary' });
});

test('signal protocol store fallback returns the fallback store only for allowed failures', async () => {
  const seen = [];
  const result = await createProtocolStoreWithFallback({
    createPrimaryStore: async () => {
      throw new Error('better_sqlite3.node missing');
    },
    createFallbackStore: async () => ({ mode: 'fallback' }),
    shouldFallback: (error) => shouldUseMemoryProtocolStoreFallback(error, { platform: 'win32' }),
    onFallback: () => seen.push('fallback'),
  });

  assert.deepEqual(result, { mode: 'fallback' });
  assert.deepEqual(seen, ['fallback']);
});

test('signal protocol store fallback rethrows non-fallback failures', async () => {
  await assert.rejects(() =>
    createProtocolStoreWithFallback({
      createPrimaryStore: async () => {
        throw new Error('ordinary failure');
      },
      createFallbackStore: async () => ({ mode: 'fallback' }),
      shouldFallback: (error) => shouldUseMemoryProtocolStoreFallback(error, { platform: 'win32' }),
    })
  );
});
