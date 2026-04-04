import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('guild settings controller composition owns resource, callback, effect, action, and view wiring', async () => {
  const compositionSource = await readFile(
    new URL('../../../client/src/features/guild/useGuildSettingsControllerComposition.mjs', import.meta.url),
    'utf8'
  );

  assert.match(compositionSource, /function useGuildSettingsControllerComposition\(/);
  assert.match(compositionSource, /from '\.\/useGuildSettingsControllerSupport\.mjs'/);
  assert.match(compositionSource, /from '\.\/useGuildSettingsControllerActionView\.mjs'/);
  assert.match(compositionSource, /useGuildSettingsControllerSupport\(/);
  assert.match(compositionSource, /useGuildSettingsControllerActionView\(/);
  assert.doesNotMatch(compositionSource, /useGuildSettingsResourceLoaders\(/);
  assert.doesNotMatch(compositionSource, /useGuildSettingsControllerCallbacks\(/);
  assert.doesNotMatch(compositionSource, /useGuildSettingsRuntimeEffects\(/);
  assert.doesNotMatch(compositionSource, /useGuildSettingsControllerActions\(/);
  assert.doesNotMatch(compositionSource, /useGuildSettingsControllerViewState\(/);
  assert.doesNotMatch(compositionSource, /buildUseGuildSettingsControllerEffectsInput\(/);
  assert.doesNotMatch(compositionSource, /buildUseGuildSettingsControllerActionsInput\(/);
  assert.doesNotMatch(compositionSource, /buildUseGuildSettingsControllerViewStateInput\(/);
});
