import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('login screen controller auth actions own nsec, bunker, and account submit handlers', async () => {
  const authActionsSource = await readFile(
    new URL('../../../client/src/features/auth/useLoginScreenControllerAuthActions.mjs', import.meta.url),
    'utf8'
  );

  assert.match(authActionsSource, /function useLoginScreenControllerAuthActions\(/);
  assert.match(authActionsSource, /from '\.\.\/\.\.\/api'/);
  assert.match(authActionsSource, /submitLoginScreenNsec\(/);
  assert.match(authActionsSource, /submitLoginScreenBunker\(/);
  assert.match(authActionsSource, /submitLoginScreenCreateAccount\(/);
  assert.match(authActionsSource, /handleNsecSubmit/);
  assert.match(authActionsSource, /handleBunkerSubmit/);
  assert.match(authActionsSource, /handleCreateAccountSubmit/);
});
