import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('guild settings controller support owns resource, callback, and runtime effect wiring', async () => {
  const supportSource = await readFile(
    new URL('../../../client/src/features/guild/useGuildSettingsControllerSupport.mjs', import.meta.url),
    'utf8'
  );

  assert.match(supportSource, /function useGuildSettingsControllerSupport\(/);
  assert.match(supportSource, /from '\.\/guildSettingsControllerInputs\.mjs'/);
  assert.match(supportSource, /from '\.\/useGuildSettingsControllerCallbacks\.mjs'/);
  assert.match(supportSource, /from '\.\/useGuildSettingsResourceLoaders\.mjs'/);
  assert.match(supportSource, /from '\.\/useGuildSettingsRuntimeEffects\.mjs'/);
  assert.match(supportSource, /useGuildSettingsResourceLoaders\(/);
  assert.match(supportSource, /useGuildSettingsControllerCallbacks\(/);
  assert.match(supportSource, /useGuildSettingsRuntimeEffects\(/);
  assert.match(supportSource, /buildUseGuildSettingsControllerEffectsInput\(/);
  assert.match(supportSource, /return \{/);
  assert.match(supportSource, /flash,/);
  assert.match(supportSource, /onSelectTab,/);
  assert.match(supportSource, /loadMembers,/);
  assert.match(supportSource, /loadRanks,/);
  assert.match(supportSource, /loadMotd,/);
  assert.match(supportSource, /loadInviteCode,/);
});
