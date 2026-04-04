import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('guild settings runtime effects delegates reset, load, and shell effect lanes to dedicated hooks', async () => {
  const runtimeEffectsSource = await readFile(
    new URL('../../../client/src/features/guild/useGuildSettingsRuntimeEffects.mjs', import.meta.url),
    'utf8'
  );

  assert.match(runtimeEffectsSource, /from '\.\/useGuildSettingsResetEffects\.mjs'/);
  assert.match(runtimeEffectsSource, /from '\.\/useGuildSettingsLoadEffects\.mjs'/);
  assert.match(runtimeEffectsSource, /from '\.\/useGuildSettingsShellEffects\.mjs'/);
  assert.match(runtimeEffectsSource, /useGuildSettingsResetEffects\(/);
  assert.match(runtimeEffectsSource, /useGuildSettingsLoadEffects\(/);
  assert.match(runtimeEffectsSource, /useGuildSettingsShellEffects\(/);
  assert.doesNotMatch(runtimeEffectsSource, /buildGuildSettingsResetState\(/);
  assert.doesNotMatch(runtimeEffectsSource, /buildGuildSettingsGuildSyncState\(/);
  assert.doesNotMatch(runtimeEffectsSource, /buildGuildSettingsWarmLoadPlan\(/);
  assert.doesNotMatch(runtimeEffectsSource, /buildGuildSettingsTabLoadPlan\(/);
  assert.doesNotMatch(runtimeEffectsSource, /window\.addEventListener\('keydown'/);
  assert.doesNotMatch(runtimeEffectsSource, /endPerfTraceAfterNextPaintFn\(/);
});
