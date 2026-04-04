import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('guild settings shell effects own escape-close and open-trace completion wiring', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/guild/useGuildSettingsShellEffects.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /function useGuildSettingsShellEffects\(/);
  assert.match(source, /window\.addEventListener\('keydown'/);
  assert.match(source, /window\.removeEventListener\('keydown'/);
  assert.match(source, /completedOpenTraceIdsRef\.current\.has\(openTraceId\)/);
  assert.match(source, /endPerfTraceAfterNextPaintFn\(openTraceId/);
});
