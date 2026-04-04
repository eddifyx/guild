import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('main layout controller bindings delegate pure owners to dedicated modules', async () => {
  const hubSource = await readFile(
    new URL('../../../client/src/features/layout/mainLayoutControllerBindings.mjs', import.meta.url),
    'utf8'
  );
  const derivedSource = await readFile(
    new URL('../../../client/src/features/layout/mainLayoutDerivedBindings.mjs', import.meta.url),
    'utf8'
  );
  const effectsSource = await readFile(
    new URL('../../../client/src/features/layout/mainLayoutEffectsBindings.mjs', import.meta.url),
    'utf8'
  );
  const viewSource = await readFile(
    new URL('../../../client/src/features/layout/mainLayoutViewBindings.mjs', import.meta.url),
    'utf8'
  );

  assert.match(hubSource, /from '\.\/mainLayoutDerivedBindings\.mjs'/);
  assert.match(hubSource, /from '\.\/mainLayoutEffectsBindings\.mjs'/);
  assert.match(hubSource, /from '\.\/mainLayoutViewBindings\.mjs'/);
  assert.doesNotMatch(hubSource, /function buildMainLayoutDerivedVoiceState\(/);
  assert.doesNotMatch(hubSource, /function buildMainLayoutControllerRuntimeOptions\(/);
  assert.doesNotMatch(hubSource, /function buildMainLayoutViewStateOptions\(/);

  assert.match(derivedSource, /function buildMainLayoutDerivedVoiceState\(/);
  assert.match(derivedSource, /function buildMainLayoutDerivedShellState\(/);
  assert.match(effectsSource, /function buildMainLayoutControllerRuntimeOptions\(/);
  assert.match(effectsSource, /function buildMainLayoutConversationEffectsOptions\(/);
  assert.match(effectsSource, /function buildMainLayoutShellEffectsOptions\(/);
  assert.match(viewSource, /function buildMainLayoutViewStateOptions\(/);
});
