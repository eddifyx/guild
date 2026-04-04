import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('following modal controller delegates tabs and rows to a dedicated view-state hook', async () => {
  const viewStateSource = await readFile(
    new URL('../../../client/src/features/social/useFollowingModalControllerViewState.mjs', import.meta.url),
    'utf8'
  );

  assert.match(viewStateSource, /function useFollowingModalControllerViewState\(/);
  assert.match(viewStateSource, /buildFollowingModalTabs\(/);
  assert.match(viewStateSource, /buildFollowingModalSearchViewState\(/);
  assert.match(viewStateSource, /buildFollowingModalFriendRow\(/);
  assert.match(viewStateSource, /buildFollowingModalIncomingRequestRow\(/);
  assert.match(viewStateSource, /buildFollowingModalSearchResultRow\(/);
  assert.match(viewStateSource, /getFollowingModalSearchMessageTone\(/);
});
