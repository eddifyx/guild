import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('guild settings controller delegates local state ownership to a dedicated state hook', async () => {
  const controllerSource = await readFile(
    new URL('../../../client/src/features/guild/useGuildSettingsController.mjs', import.meta.url),
    'utf8'
  );
  const stateSource = await readFile(
    new URL('../../../client/src/features/guild/useGuildSettingsControllerState.mjs', import.meta.url),
    'utf8'
  );

  assert.match(controllerSource, /from '\.\/useGuildSettingsControllerState\.mjs'/);
  assert.match(controllerSource, /useGuildSettingsControllerState\(/);
  assert.doesNotMatch(controllerSource, /const \[tab, setTab\] = useState\(/);
  assert.doesNotMatch(controllerSource, /const loadingRef = useRef\(/);
  assert.doesNotMatch(controllerSource, /useTransition\(/);
  assert.doesNotMatch(controllerSource, /useEffect\(\(\) => \(\) =>/);

  assert.match(stateSource, /function createGuildSettingsInitialLoadingState\(/);
  assert.match(stateSource, /function useGuildSettingsControllerState\(/);
  assert.match(stateSource, /const \[tab, setTab\] = useState\(/);
  assert.match(stateSource, /const \[isTabPending, startTabTransition\] = useTransition\(/);
  assert.match(stateSource, /const loadingRef = useRef\(createGuildSettingsInitialLoadingState\(\)\)/);
  assert.match(stateSource, /URL\.revokeObjectURL\(imagePreview\)/);
});
