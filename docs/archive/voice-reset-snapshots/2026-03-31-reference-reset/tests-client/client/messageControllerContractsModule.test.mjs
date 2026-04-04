import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('message controller contracts delegate flow and runtime contract builders through one public hub', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/messageControllerContracts.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /from '\.\/messageFlowContracts\.mjs'/);
  assert.match(source, /from '\.\/messageRuntimeContracts\.mjs'/);
  assert.doesNotMatch(source, /function buildUseMessagesFlowContracts\(/);
  assert.doesNotMatch(source, /function buildUseMessagesRuntimeContracts\(/);
});
