import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('guild settings controller delegates controller-level option shaping to dedicated input builders', async () => {
  const compositionSource = await readFile(
    new URL('../../../client/src/features/guild/useGuildSettingsControllerComposition.mjs', import.meta.url),
    'utf8'
  );
  const supportSource = await readFile(
    new URL('../../../client/src/features/guild/useGuildSettingsControllerSupport.mjs', import.meta.url),
    'utf8'
  );
  const actionViewSource = await readFile(
    new URL('../../../client/src/features/guild/useGuildSettingsControllerActionView.mjs', import.meta.url),
    'utf8'
  );
  const inputsSource = await readFile(
    new URL('../../../client/src/features/guild/guildSettingsControllerInputs.mjs', import.meta.url),
    'utf8'
  );

  assert.match(compositionSource, /useGuildSettingsControllerSupport\(/);
  assert.match(compositionSource, /useGuildSettingsControllerActionView\(/);
  assert.doesNotMatch(compositionSource, /buildUseGuildSettingsControllerEffectsInput\(/);
  assert.doesNotMatch(compositionSource, /buildUseGuildSettingsControllerActionsInput\(/);
  assert.doesNotMatch(compositionSource, /buildUseGuildSettingsControllerViewStateInput\(/);
  assert.match(supportSource, /buildUseGuildSettingsControllerEffectsInput\(/);
  assert.match(actionViewSource, /buildUseGuildSettingsControllerActionsInput\(/);
  assert.match(actionViewSource, /buildUseGuildSettingsControllerViewStateInput\(/);
  assert.match(inputsSource, /function buildUseGuildSettingsControllerEffectsInput\(/);
  assert.match(inputsSource, /function buildUseGuildSettingsControllerActionsInput\(/);
  assert.match(inputsSource, /function buildUseGuildSettingsControllerViewStateInput\(/);
});
