import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('following modal search actions own search input and transient search-message resets', async () => {
  const searchActionsSource = await readFile(
    new URL('../../../client/src/features/social/useFollowingModalControllerSearchActions.mjs', import.meta.url),
    'utf8'
  );

  assert.match(searchActionsSource, /function useFollowingModalControllerSearchActions\(/);
  assert.match(searchActionsSource, /useCallback\(/);
  assert.match(searchActionsSource, /setTimeout\(/);
  assert.match(searchActionsSource, /setQuery\(/);
  assert.match(searchActionsSource, /setSearchMsg\(/);
  assert.doesNotMatch(searchActionsSource, /createFollowingModalSendRequestAction\(/);
  assert.doesNotMatch(searchActionsSource, /createFollowingModalCopyInviteAction\(/);
  assert.doesNotMatch(searchActionsSource, /openFollowingModalPrimalProfile\(/);
});
