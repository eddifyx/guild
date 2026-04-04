import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('voice hook screen share controller wrapper exports the expected hook factory', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/voice/useVoiceHookScreenShareController.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /export function useVoiceHookScreenShareController/);
});
