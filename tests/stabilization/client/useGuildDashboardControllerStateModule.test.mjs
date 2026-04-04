import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('guild dashboard controller delegates local state ownership to a dedicated state hook', async () => {
  const controllerSource = await readFile(
    new URL('../../../client/src/features/guild/useGuildDashboardController.mjs', import.meta.url),
    'utf8'
  );
  const stateSource = await readFile(
    new URL('../../../client/src/features/guild/useGuildDashboardControllerState.mjs', import.meta.url),
    'utf8'
  );

  assert.match(controllerSource, /from '\.\/useGuildDashboardControllerState\.mjs'/);
  assert.match(controllerSource, /useGuildDashboardControllerState\(/);
  assert.doesNotMatch(controllerSource, /const \[members, setMembers\] = useState\(/);
  assert.doesNotMatch(controllerSource, /const statusInputRef = useRef\(/);

  assert.match(stateSource, /function useGuildDashboardControllerState\(/);
  assert.match(stateSource, /const \[members, setMembers\] = useState\(\[\]\)/);
  assert.match(stateSource, /const \[myStatus, setMyStatus\] = useState\(''\)/);
  assert.match(stateSource, /const statusInputRef = useRef\(null\)/);
});
