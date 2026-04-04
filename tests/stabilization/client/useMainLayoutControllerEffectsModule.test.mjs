import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('main layout controller delegates conversation and shell effect wiring to a dedicated effects hook', async () => {
  const runtimeViewSource = await readFile(
    new URL('../../../client/src/features/layout/useMainLayoutControllerRuntimeView.mjs', import.meta.url),
    'utf8'
  );
  const effectsSource = await readFile(
    new URL('../../../client/src/features/layout/useMainLayoutControllerEffects.mjs', import.meta.url),
    'utf8'
  );

  assert.match(runtimeViewSource, /from '\.\/useMainLayoutControllerEffects\.mjs'/);
  assert.match(runtimeViewSource, /useMainLayoutControllerEffects\(/);
  assert.doesNotMatch(runtimeViewSource, /buildMainLayoutConversationEffectsInput\(/);
  assert.doesNotMatch(runtimeViewSource, /buildMainLayoutShellEffectsInput\(/);
  assert.match(effectsSource, /function useMainLayoutControllerEffects\(/);
  assert.match(effectsSource, /buildMainLayoutConversationEffectsInput\(/);
  assert.match(effectsSource, /buildMainLayoutShellEffectsInput\(/);
});
