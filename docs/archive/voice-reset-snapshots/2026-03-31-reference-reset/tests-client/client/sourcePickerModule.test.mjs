import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('source picker delegates controller state to the shared controller hook', async () => {
  const controllerModule = await import('../../../client/src/features/stream/useSourcePickerController.mjs');
  const sourcePickerSource = await readFile(
    new URL('../../../client/src/components/Stream/SourcePicker.jsx', import.meta.url),
    'utf8'
  );

  assert.equal(typeof controllerModule.useSourcePickerController, 'function');
  assert.match(sourcePickerSource, /import\s+\{\s*useSourcePickerController\s*\}\s+from/);
  assert.match(sourcePickerSource, /useSourcePickerController\(\{/);
});
