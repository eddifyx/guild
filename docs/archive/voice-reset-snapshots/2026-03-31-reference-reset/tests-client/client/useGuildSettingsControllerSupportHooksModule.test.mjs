import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('guild settings controller support hooks delegate resource loaders and shell callbacks to dedicated modules', async () => {
  const supportSource = await readFile(
    new URL('../../../client/src/features/guild/useGuildSettingsControllerSupport.mjs', import.meta.url),
    'utf8'
  );
  const resourceLoadersSource = await readFile(
    new URL('../../../client/src/features/guild/useGuildSettingsResourceLoaders.mjs', import.meta.url),
    'utf8'
  );
  const callbacksSource = await readFile(
    new URL('../../../client/src/features/guild/useGuildSettingsControllerCallbacks.mjs', import.meta.url),
    'utf8'
  );

  assert.match(supportSource, /from '\.\/useGuildSettingsResourceLoaders\.mjs'/);
  assert.match(supportSource, /from '\.\/useGuildSettingsControllerCallbacks\.mjs'/);
  assert.match(supportSource, /useGuildSettingsResourceLoaders\(/);
  assert.match(supportSource, /useGuildSettingsControllerCallbacks\(/);
  assert.doesNotMatch(supportSource, /createGuildSettingsResourceLoader\(/);
  assert.doesNotMatch(supportSource, /createGuildSettingsFlash\(/);
  assert.doesNotMatch(supportSource, /selectGuildSettingsTab\(/);

  assert.match(resourceLoadersSource, /createGuildSettingsResourceLoader/);
  assert.match(callbacksSource, /createGuildSettingsFlash/);
  assert.match(callbacksSource, /selectGuildSettingsTab/);
});
