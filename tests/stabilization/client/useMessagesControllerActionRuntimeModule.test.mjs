import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('messages controller action runtime owns action creation through the shared factory', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/useMessagesControllerActionRuntime.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /function useMessagesControllerActionRuntime\(/);
  assert.match(source, /useMemo\(/);
  assert.match(source, /createMessageControllerActions\(/);
  assert.doesNotMatch(source, /useMessagesRuntimeEffects\(/);
  assert.doesNotMatch(source, /windowObject\.clearTimeout\(/);
});
