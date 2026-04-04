import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('guild settings reset effects own reset and guild sync effect wiring', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/guild/useGuildSettingsResetEffects.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /function useGuildSettingsResetEffects\(/);
  assert.match(source, /buildGuildSettingsResetState\(/);
  assert.match(source, /buildGuildSettingsGuildSyncState\(/);
  assert.match(source, /loadingRef\.current = resetState\.loading/);
  assert.match(source, /setImagePreviewFn\(null\)/);
});
