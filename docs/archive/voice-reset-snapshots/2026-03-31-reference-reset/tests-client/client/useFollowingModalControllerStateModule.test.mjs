import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('following modal controller delegates local state ownership to a dedicated state hook', async () => {
  const controllerSource = await readFile(
    new URL('../../../client/src/features/social/useFollowingModalController.mjs', import.meta.url),
    'utf8'
  );
  const stateSource = await readFile(
    new URL('../../../client/src/features/social/useFollowingModalControllerState.mjs', import.meta.url),
    'utf8'
  );

  assert.match(controllerSource, /from '\.\/useFollowingModalControllerState\.mjs'/);
  assert.match(controllerSource, /useFollowingModalControllerState\(/);
  assert.doesNotMatch(controllerSource, /const \[tab, setTab\] = useState\(/);
  assert.doesNotMatch(controllerSource, /const searchTimerRef = useRef\(/);

  assert.match(stateSource, /function useFollowingModalControllerState\(/);
  assert.match(stateSource, /const \[tab, setTab\] = useState\('friends'\)/);
  assert.match(stateSource, /const \[contacts, setContacts\] = useState\(\[\]\)/);
  assert.match(stateSource, /const \[searchResults, setSearchResults\] = useState\(\[\]\)/);
  assert.match(stateSource, /const searchTimerRef = useRef\(null\)/);
});
