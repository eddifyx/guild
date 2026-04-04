import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('following modal controller effects own runtime loader, socket, search, and lifecycle orchestration', async () => {
  const effectsSource = await readFile(
    new URL('../../../client/src/features/social/useFollowingModalControllerEffects.mjs', import.meta.url),
    'utf8'
  );

  assert.match(effectsSource, /function useFollowingModalControllerEffects\(/);
  assert.match(effectsSource, /createFollowingModalLoadFriendsAction\(/);
  assert.match(effectsSource, /createFollowingModalLoadRequestsAction\(/);
  assert.match(effectsSource, /createFollowingModalLoadSentRequestsAction\(/);
  assert.match(effectsSource, /bindFollowingModalSocketRuntime\(/);
  assert.match(effectsSource, /startFollowingModalSearchRuntime\(/);
  assert.match(effectsSource, /useFollowingModalRuntimeEffects\(/);
});
