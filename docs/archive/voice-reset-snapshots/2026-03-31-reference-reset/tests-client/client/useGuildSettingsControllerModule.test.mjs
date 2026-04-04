import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('guild settings controller delegates pure input shaping to the dedicated inputs module', async () => {
  const controllerSource = await readFile(
    new URL('../../../client/src/features/guild/useGuildSettingsController.mjs', import.meta.url),
    'utf8'
  );
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
  const actionsSource = await readFile(
    new URL('../../../client/src/features/guild/useGuildSettingsControllerActions.mjs', import.meta.url),
    'utf8'
  );
  const stateSource = await readFile(
    new URL('../../../client/src/features/guild/useGuildSettingsControllerState.mjs', import.meta.url),
    'utf8'
  );
  const derivedStateSource = await readFile(
    new URL('../../../client/src/features/guild/useGuildSettingsControllerDerivedState.mjs', import.meta.url),
    'utf8'
  );
  const callbacksSource = await readFile(
    new URL('../../../client/src/features/guild/useGuildSettingsControllerCallbacks.mjs', import.meta.url),
    'utf8'
  );
  const resourceLoadersSource = await readFile(
    new URL('../../../client/src/features/guild/useGuildSettingsResourceLoaders.mjs', import.meta.url),
    'utf8'
  );
  const viewSource = await readFile(
    new URL('../../../client/src/features/guild/useGuildSettingsControllerViewState.mjs', import.meta.url),
    'utf8'
  );

  assert.match(controllerSource, /from '\.\/useGuildSettingsControllerComposition\.mjs'/);
  assert.match(controllerSource, /from '\.\/useGuildSettingsControllerDerivedState\.mjs'/);
  assert.match(controllerSource, /from '\.\/useGuildSettingsControllerState\.mjs'/);
  assert.match(controllerSource, /useGuildSettingsControllerComposition\(/);
  assert.match(controllerSource, /useGuildSettingsControllerDerivedState\(/);
  assert.match(controllerSource, /useGuildSettingsControllerState\(/);
  assert.doesNotMatch(controllerSource, /from '\.\/guildSettingsControllerInputs\.mjs'/);
  assert.doesNotMatch(controllerSource, /from '\.\/useGuildSettingsControllerActions\.mjs'/);
  assert.doesNotMatch(controllerSource, /from '\.\/useGuildSettingsControllerCallbacks\.mjs'/);
  assert.doesNotMatch(controllerSource, /from '\.\/useGuildSettingsResourceLoaders\.mjs'/);
  assert.doesNotMatch(controllerSource, /from '\.\/useGuildSettingsControllerViewState\.mjs'/);
  assert.doesNotMatch(controllerSource, /buildUseGuildSettingsControllerEffectsInput\(/);
  assert.doesNotMatch(controllerSource, /buildUseGuildSettingsControllerActionsInput\(/);
  assert.doesNotMatch(controllerSource, /buildUseGuildSettingsControllerViewStateInput\(/);
  assert.doesNotMatch(controllerSource, /useGuildSettingsRuntimeEffects\(\{/);
  assert.doesNotMatch(controllerSource, /useGuildSettingsControllerActions\(/);
  assert.doesNotMatch(controllerSource, /useGuildSettingsControllerCallbacks\(/);
  assert.doesNotMatch(controllerSource, /useGuildSettingsResourceLoaders\(/);
  assert.doesNotMatch(controllerSource, /useGuildSettingsControllerViewState\(/);
  assert.match(compositionSource, /from '\.\/useGuildSettingsControllerSupport\.mjs'/);
  assert.match(compositionSource, /from '\.\/useGuildSettingsControllerActionView\.mjs'/);
  assert.match(compositionSource, /useGuildSettingsControllerSupport\(/);
  assert.match(compositionSource, /useGuildSettingsControllerActionView\(/);
  assert.doesNotMatch(compositionSource, /from '\.\/guildSettingsControllerInputs\.mjs'/);
  assert.doesNotMatch(compositionSource, /from '\.\/useGuildSettingsControllerActions\.mjs'/);
  assert.doesNotMatch(compositionSource, /from '\.\/useGuildSettingsControllerCallbacks\.mjs'/);
  assert.doesNotMatch(compositionSource, /from '\.\/useGuildSettingsResourceLoaders\.mjs'/);
  assert.doesNotMatch(compositionSource, /from '\.\/useGuildSettingsControllerViewState\.mjs'/);
  assert.doesNotMatch(compositionSource, /buildUseGuildSettingsControllerEffectsInput\(/);
  assert.doesNotMatch(compositionSource, /buildUseGuildSettingsControllerActionsInput\(/);
  assert.doesNotMatch(compositionSource, /buildUseGuildSettingsControllerViewStateInput\(/);
  assert.doesNotMatch(compositionSource, /useGuildSettingsControllerActions\(/);
  assert.doesNotMatch(compositionSource, /useGuildSettingsControllerCallbacks\(/);
  assert.doesNotMatch(compositionSource, /useGuildSettingsResourceLoaders\(/);
  assert.doesNotMatch(compositionSource, /useGuildSettingsControllerViewState\(/);
  assert.match(supportSource, /from '\.\/guildSettingsControllerInputs\.mjs'/);
  assert.match(supportSource, /from '\.\/useGuildSettingsControllerCallbacks\.mjs'/);
  assert.match(supportSource, /from '\.\/useGuildSettingsResourceLoaders\.mjs'/);
  assert.match(supportSource, /from '\.\/useGuildSettingsRuntimeEffects\.mjs'/);
  assert.match(supportSource, /buildUseGuildSettingsControllerEffectsInput\(/);
  assert.match(supportSource, /useGuildSettingsControllerCallbacks\(/);
  assert.match(supportSource, /useGuildSettingsResourceLoaders\(/);
  assert.match(supportSource, /useGuildSettingsRuntimeEffects\(/);
  assert.match(actionViewSource, /from '\.\/guildSettingsControllerInputs\.mjs'/);
  assert.match(actionViewSource, /from '\.\/useGuildSettingsControllerActions\.mjs'/);
  assert.match(actionViewSource, /from '\.\/useGuildSettingsControllerViewState\.mjs'/);
  assert.match(actionViewSource, /buildUseGuildSettingsControllerActionsInput\(/);
  assert.match(actionViewSource, /buildUseGuildSettingsControllerViewStateInput\(/);
  assert.match(actionViewSource, /useGuildSettingsControllerActions\(/);
  assert.match(actionViewSource, /useGuildSettingsControllerViewState\(/);
  assert.match(inputsSource, /function buildGuildSettingsRuntimeEffectsInput\(/);
  assert.match(inputsSource, /function buildUseGuildSettingsControllerEffectsInput\(/);
  assert.match(inputsSource, /function buildGuildSettingsControllerActionInput\(/);
  assert.match(inputsSource, /function buildUseGuildSettingsControllerActionsInput\(/);
  assert.match(inputsSource, /function buildGuildSettingsControllerViewInput\(/);
  assert.match(inputsSource, /function buildUseGuildSettingsControllerViewStateInput\(/);
  assert.match(actionsSource, /buildGuildSettingsControllerActionInput\(/);
  assert.match(actionsSource, /createGuildSettingsControllerActions\(/);
  assert.match(stateSource, /function useGuildSettingsControllerState\(/);
  assert.match(derivedStateSource, /function useGuildSettingsControllerDerivedState\(/);
  assert.match(callbacksSource, /createGuildSettingsFlash/);
  assert.match(callbacksSource, /selectGuildSettingsTab/);
  assert.match(resourceLoadersSource, /createGuildSettingsResourceLoader/);
  assert.match(viewSource, /buildGuildSettingsControllerViewInput\(/);
  assert.match(viewSource, /buildGuildSettingsControllerViewState\(/);
});
