import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('guild settings controller action/view owner wires actions and view state through dedicated builders', async () => {
  const actionViewSource = await readFile(
    new URL('../../../client/src/features/guild/useGuildSettingsControllerActionView.mjs', import.meta.url),
    'utf8'
  );

  assert.match(actionViewSource, /function useGuildSettingsControllerActionView\(/);
  assert.match(actionViewSource, /from '\.\/guildSettingsControllerInputs\.mjs'/);
  assert.match(actionViewSource, /from '\.\/useGuildSettingsControllerActions\.mjs'/);
  assert.match(actionViewSource, /from '\.\/useGuildSettingsControllerViewState\.mjs'/);
  assert.match(actionViewSource, /useGuildSettingsControllerActions\(/);
  assert.match(actionViewSource, /buildUseGuildSettingsControllerActionsInput\(/);
  assert.match(actionViewSource, /useGuildSettingsControllerViewState\(/);
  assert.match(actionViewSource, /buildUseGuildSettingsControllerViewStateInput\(/);
  assert.match(actionViewSource, /support = \{\}/);
  assert.match(actionViewSource, /support\.flash/);
  assert.match(actionViewSource, /support\.loadMembers/);
  assert.match(actionViewSource, /support\.loadRanks/);
  assert.match(actionViewSource, /support\.onSelectTab/);
});
