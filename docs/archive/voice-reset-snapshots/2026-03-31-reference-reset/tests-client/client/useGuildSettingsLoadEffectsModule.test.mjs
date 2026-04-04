import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('guild settings load effects own warm-load and tab-load effect wiring', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/guild/useGuildSettingsLoadEffects.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /function useGuildSettingsLoadEffects\(/);
  assert.match(source, /buildGuildSettingsWarmLoadPlan\(/);
  assert.match(source, /buildGuildSettingsTabLoadPlan\(/);
  assert.match(source, /window\.setTimeout\(/);
  assert.match(source, /loadInviteCode\(\)\.catch/);
  assert.match(source, /loadMotd\(\)\.catch/);
});
