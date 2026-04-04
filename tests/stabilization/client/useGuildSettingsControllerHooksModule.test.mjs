import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('guild settings controller hook owners delegate action and view composition to dedicated modules', async () => {
  const actionsSource = await readFile(
    new URL('../../../client/src/features/guild/useGuildSettingsControllerActions.mjs', import.meta.url),
    'utf8'
  );
  const viewSource = await readFile(
    new URL('../../../client/src/features/guild/useGuildSettingsControllerViewState.mjs', import.meta.url),
    'utf8'
  );

  assert.match(actionsSource, /createGuildSettingsControllerActions/);
  assert.match(actionsSource, /buildGuildSettingsActionOptions/);
  assert.match(actionsSource, /buildGuildSettingsControllerActionInput/);
  assert.match(viewSource, /buildGuildSettingsControllerViewState/);
  assert.match(viewSource, /buildGuildSettingsControllerViewInput/);
});
