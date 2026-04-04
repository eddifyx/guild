import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('guild settings controller delegates memoized member and shell state to a dedicated derived-state hook', async () => {
  const controllerSource = await readFile(
    new URL('../../../client/src/features/guild/useGuildSettingsController.mjs', import.meta.url),
    'utf8'
  );
  const derivedStateSource = await readFile(
    new URL('../../../client/src/features/guild/useGuildSettingsControllerDerivedState.mjs', import.meta.url),
    'utf8'
  );

  assert.match(controllerSource, /from '\.\/useGuildSettingsControllerDerivedState\.mjs'/);
  assert.match(controllerSource, /useGuildSettingsControllerDerivedState\(/);
  assert.doesNotMatch(controllerSource, /buildGuildSettingsMemberState\(/);
  assert.doesNotMatch(controllerSource, /buildGuildSettingsShellState\(/);

  assert.match(derivedStateSource, /function useGuildSettingsControllerDerivedState\(/);
  assert.match(derivedStateSource, /buildGuildSettingsMemberState\(/);
  assert.match(derivedStateSource, /buildGuildSettingsShellState\(/);
  assert.match(derivedStateSource, /useMemo\(/);
});
