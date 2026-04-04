import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('login screen controller composition owns runtime effects and action orchestration', async () => {
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

  assert.match(compositionSource, /function useLoginScreenControllerComposition\(/);
  assert.match(compositionSource, /useLoginScreenControllerEffects\(/);
  assert.match(compositionSource, /useLoginScreenControllerActions\(/);
  assert.doesNotMatch(compositionSource, /startLoginScreenQrSession\(/);
  assert.doesNotMatch(compositionSource, /createLoginScreenAuthChallengeHandler\(/);
  assert.doesNotMatch(compositionSource, /syncLoginScreenImagePreview\(/);
  assert.doesNotMatch(compositionSource, /submitLoginScreenNsec\(/);
  assert.doesNotMatch(compositionSource, /submitLoginScreenBunker\(/);
  assert.doesNotMatch(compositionSource, /submitLoginScreenCreateAccount\(/);
  assert.doesNotMatch(compositionSource, /copyLoginScreenValue\(/);
  assert.match(effectsSource, /useLoginScreenQrEffects\(/);
  assert.match(effectsSource, /useLoginScreenSupportEffects\(/);
  assert.match(qrEffectsSource, /startLoginScreenQrSession\(/);
  assert.match(supportEffectsSource, /createLoginScreenAuthChallengeHandler\(/);
  assert.match(supportEffectsSource, /syncLoginScreenImagePreview\(/);
  assert.match(actionsSource, /useLoginScreenControllerAuthActions\(/);
  assert.match(actionsSource, /useLoginScreenControllerUiActions\(/);
  assert.match(authActionsSource, /submitLoginScreenNsec\(/);
  assert.match(authActionsSource, /submitLoginScreenBunker\(/);
  assert.match(authActionsSource, /submitLoginScreenCreateAccount\(/);
  assert.match(uiActionsSource, /copyLoginScreenValue\(/);
  assert.match(uiActionsSource, /resetLoginScreenView\(/);
});
