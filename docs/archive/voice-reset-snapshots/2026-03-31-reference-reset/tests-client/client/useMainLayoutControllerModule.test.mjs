import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('main layout controller delegates pure input shaping to the dedicated inputs module', async () => {
  const controllerSource = await readFile(
    new URL('../../../client/src/features/layout/useMainLayoutController.mjs', import.meta.url),
    'utf8'
  );
  const compositionSource = await readFile(
    new URL('../../../client/src/features/layout/useMainLayoutControllerComposition.mjs', import.meta.url),
    'utf8'
  );
  const supportSource = await readFile(
    new URL('../../../client/src/features/layout/useMainLayoutControllerSupport.mjs', import.meta.url),
    'utf8'
  );
  const runtimeViewSource = await readFile(
    new URL('../../../client/src/features/layout/useMainLayoutControllerRuntimeView.mjs', import.meta.url),
    'utf8'
  );
  const inputsSource = await readFile(
    new URL('../../../client/src/features/layout/mainLayoutControllerInputs.mjs', import.meta.url),
    'utf8'
  );
  const stateSource = await readFile(
    new URL('../../../client/src/features/layout/useMainLayoutControllerState.mjs', import.meta.url),
    'utf8'
  );
  const derivedStateSource = await readFile(
    new URL('../../../client/src/features/layout/useMainLayoutControllerDerivedState.mjs', import.meta.url),
    'utf8'
  );
  const effectsSource = await readFile(
    new URL('../../../client/src/features/layout/useMainLayoutControllerEffects.mjs', import.meta.url),
    'utf8'
  );
  const viewStateSource = await readFile(
    new URL('../../../client/src/features/layout/useMainLayoutControllerViewState.mjs', import.meta.url),
    'utf8'
  );

  assert.match(controllerSource, /from '\.\/useMainLayoutControllerComposition\.mjs'/);
  assert.match(controllerSource, /from '\.\/useMainLayoutControllerState\.mjs'/);
  assert.match(controllerSource, /from '\.\/useMainLayoutControllerDerivedState\.mjs'/);
  assert.match(controllerSource, /useMainLayoutControllerState\(/);
  assert.match(controllerSource, /useMainLayoutControllerDerivedState\(/);
  assert.match(controllerSource, /useMainLayoutControllerComposition\(/);
  assert.doesNotMatch(controllerSource, /from '\.\/mainLayoutControllerInputs\.mjs'/);
  assert.doesNotMatch(controllerSource, /from '\.\/useMainLayoutControllerEffects\.mjs'/);
  assert.doesNotMatch(controllerSource, /from '\.\/useMainLayoutControllerViewState\.mjs'/);
  assert.doesNotMatch(controllerSource, /buildMainLayoutControllerRuntimeInput\(/);
  assert.doesNotMatch(controllerSource, /useMainLayoutControllerEffects\(/);
  assert.doesNotMatch(controllerSource, /useMainLayoutControllerViewState\(/);
  assert.match(compositionSource, /from '\.\/useMainLayoutControllerSupport\.mjs'/);
  assert.match(compositionSource, /from '\.\/useMainLayoutControllerRuntimeView\.mjs'/);
  assert.match(compositionSource, /useMainLayoutControllerSupport\(/);
  assert.match(compositionSource, /useMainLayoutControllerRuntimeView\(/);
  assert.doesNotMatch(compositionSource, /from '\.\/mainLayoutControllerInputs\.mjs'/);
  assert.doesNotMatch(compositionSource, /from '\.\/useMainLayoutControllerEffects\.mjs'/);
  assert.doesNotMatch(compositionSource, /from '\.\/useMainLayoutControllerViewState\.mjs'/);
  assert.doesNotMatch(compositionSource, /buildMainLayoutControllerRuntimeInput\(/);
  assert.doesNotMatch(compositionSource, /useMainLayoutControllerRuntime\(/);
  assert.doesNotMatch(compositionSource, /useMainLayoutControllerEffects\(/);
  assert.doesNotMatch(compositionSource, /useMainLayoutControllerViewState\(/);
  assert.match(supportSource, /useRooms\(/);
  assert.match(supportSource, /useNotifications\(/);
  assert.match(supportSource, /useUnreadDMs\(/);
  assert.match(supportSource, /useUnreadRooms\(/);
  assert.match(supportSource, /useGuildChat\(/);
  assert.match(runtimeViewSource, /from '\.\/mainLayoutControllerInputs\.mjs'/);
  assert.match(runtimeViewSource, /from '\.\/useMainLayoutControllerEffects\.mjs'/);
  assert.match(runtimeViewSource, /from '\.\/useMainLayoutControllerViewState\.mjs'/);
  assert.match(runtimeViewSource, /buildMainLayoutControllerRuntimeInput\(/);
  assert.match(runtimeViewSource, /useMainLayoutControllerRuntime\(/);
  assert.match(runtimeViewSource, /useMainLayoutControllerEffects\(/);
  assert.match(runtimeViewSource, /useMainLayoutControllerViewState\(/);
  assert.match(inputsSource, /function buildMainLayoutDerivedVoiceInput\(/);
  assert.match(inputsSource, /function buildMainLayoutDerivedShellInput\(/);
  assert.match(inputsSource, /function buildMainLayoutControllerRuntimeInput\(/);
  assert.match(inputsSource, /function buildMainLayoutConversationEffectsInput\(/);
  assert.match(inputsSource, /function buildMainLayoutShellEffectsInput\(/);
  assert.match(inputsSource, /function buildMainLayoutViewInput\(/);
  assert.match(stateSource, /function useMainLayoutControllerState\(/);
  assert.match(derivedStateSource, /function useMainLayoutControllerDerivedState\(/);
  assert.match(effectsSource, /function useMainLayoutControllerEffects\(/);
  assert.match(viewStateSource, /function useMainLayoutControllerViewState\(/);
});
