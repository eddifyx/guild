import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  createCachedAsyncLoader,
} = require('../../../client/electron/crypto/signalProtocolStoreClassCache.js');

test('signal protocol store class cache only loads the async value once', async () => {
  let calls = 0;
  const getValue = createCachedAsyncLoader(async () => {
    calls += 1;
    return { token: 'cached-value' };
  });

  const [first, second] = await Promise.all([getValue(), getValue()]);

  assert.equal(calls, 1);
  assert.equal(first, second);
  assert.equal((await getValue()).token, 'cached-value');
});
