import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('message flow contracts own flow-level contract shaping and room committed raf logging', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/messageFlowContracts.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /function buildUseMessagesFlowContracts\(/);
  assert.match(source, /requestAnimationFrame/);
  assert.doesNotMatch(source, /function buildUseMessagesRuntimeContracts\(/);
});
