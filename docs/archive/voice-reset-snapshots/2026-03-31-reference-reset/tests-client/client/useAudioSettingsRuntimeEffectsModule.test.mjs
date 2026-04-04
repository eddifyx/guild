import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('audio settings runtime effects keep restart and stop handlers in refs to avoid rerender loops', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/voice/useAudioSettingsRuntimeEffects.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /useEffect,\s*useRef/);
  assert.match(source, /const restartTestFnRef = useRef\(restartTestFn\);/);
  assert.match(source, /const stopTestFnRef = useRef\(stopTestFn\);/);
  assert.match(source, /const updateMicMeterFnRef = useRef\(updateMicMeterFn\);/);
  assert.match(source, /const previousSelectedOutputRef = useRef\(selectedOutput\);/);
  assert.match(source, /restartTestFnRef\.current = restartTestFn;/);
  assert.match(source, /stopTestFnRef\.current = stopTestFn;/);
  assert.match(source, /updateMicMeterFnRef\.current = updateMicMeterFn;/);
  assert.match(source, /if \(previousSelectedOutput === selectedOutput\) \{/);
  assert.match(source, /restartTestFnRef\.current\?\.\(\);/);
  assert.match(source, /void stopTestFnRef\.current\?\.\(\);/);
  assert.match(source, /updateMicMeterFnRef\.current\?\.\(0\);/);
});
