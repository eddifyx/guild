import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('login screen controller delegates state, view-state, and composition to dedicated owners', async () => {
  const controllerSource = await readFile(
    new URL('../../../client/src/features/auth/useLoginScreenController.mjs', import.meta.url),
    'utf8'
  );
  const compositionSource = await readFile(
    new URL('../../../client/src/features/auth/useLoginScreenControllerComposition.mjs', import.meta.url),
    'utf8'
  );
  const effectsSource = await readFile(
    new URL('../../../client/src/features/auth/useLoginScreenControllerEffects.mjs', import.meta.url),
    'utf8'
  );
  const qrEffectsSource = await readFile(
    new URL('../../../client/src/features/auth/useLoginScreenQrEffects.mjs', import.meta.url),
    'utf8'
  );
  const supportEffectsSource = await readFile(
    new URL('../../../client/src/features/auth/useLoginScreenSupportEffects.mjs', import.meta.url),
    'utf8'
  );
  const actionsSource = await readFile(
    new URL('../../../client/src/features/auth/useLoginScreenControllerActions.mjs', import.meta.url),
    'utf8'
  );
  const authActionsSource = await readFile(
    new URL('../../../client/src/features/auth/useLoginScreenControllerAuthActions.mjs', import.meta.url),
    'utf8'
  );
  const uiActionsSource = await readFile(
    new URL('../../../client/src/features/auth/useLoginScreenControllerUiActions.mjs', import.meta.url),
    'utf8'
  );
  const stateSource = await readFile(
    new URL('../../../client/src/features/auth/useLoginScreenControllerState.mjs', import.meta.url),
    'utf8'
  );
  const viewStateSource = await readFile(
    new URL('../../../client/src/features/auth/useLoginScreenControllerViewState.mjs', import.meta.url),
    'utf8'
  );

  assert.match(controllerSource, /from '\.\/useLoginScreenControllerComposition\.mjs'/);
  assert.match(controllerSource, /from '\.\/useLoginScreenControllerState\.mjs'/);
  assert.match(controllerSource, /from '\.\/useLoginScreenControllerViewState\.mjs'/);
  assert.match(controllerSource, /useLoginScreenControllerState\(/);
  assert.match(controllerSource, /useLoginScreenControllerViewState\(/);
  assert.match(controllerSource, /useLoginScreenControllerComposition\(/);
  assert.doesNotMatch(controllerSource, /startLoginScreenQrSession\(/);
  assert.doesNotMatch(controllerSource, /syncLoginScreenImagePreview\(/);
  assert.doesNotMatch(controllerSource, /submitLoginScreenNsec\(/);
  assert.doesNotMatch(controllerSource, /buildLoginScreenFormState\(/);
  assert.doesNotMatch(controllerSource, /const \[view, setView\] = useState\(/);

  assert.match(compositionSource, /useLoginScreenControllerEffects\(/);
  assert.match(compositionSource, /useLoginScreenControllerActions\(/);
  assert.match(effectsSource, /useLoginScreenQrEffects\(/);
  assert.match(effectsSource, /useLoginScreenSupportEffects\(/);
  assert.match(qrEffectsSource, /startLoginScreenQrSession\(/);
  assert.match(supportEffectsSource, /syncLoginScreenImagePreview\(/);
  assert.match(actionsSource, /useLoginScreenControllerAuthActions\(/);
  assert.match(actionsSource, /useLoginScreenControllerUiActions\(/);
  assert.match(authActionsSource, /submitLoginScreenNsec\(/);
  assert.match(uiActionsSource, /copyLoginScreenValue\(/);
  assert.match(stateSource, /function useLoginScreenControllerState\(/);
  assert.match(viewStateSource, /function useLoginScreenControllerViewState\(/);
});
