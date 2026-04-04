import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('following modal socket runtime owns request-received and request-accepted bindings', async () => {
  const socketRuntimeSource = await readFile(
    new URL('../../../client/src/features/social/followingModalSocketRuntime.mjs', import.meta.url),
    'utf8'
  );

  assert.match(socketRuntimeSource, /function bindFollowingModalSocketRuntime\(/);
  assert.match(socketRuntimeSource, /mergeFollowingModalIncomingRequests/);
  assert.match(socketRuntimeSource, /friend:request-received/);
  assert.match(socketRuntimeSource, /friend:request-accepted/);
});
