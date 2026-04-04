import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('login screen controller actions own nsec, bunker, account, copy, and view handlers', async () => {
  const actionsSource = await readFile(
    new URL('../../../client/src/features/auth/useLoginScreenControllerActions.mjs', import.meta.url),
    'utf8'
  );

  assert.match(actionsSource, /function useLoginScreenControllerActions\(/);
  assert.match(actionsSource, /from '\.\/useLoginScreenControllerAuthActions\.mjs'/);
  assert.match(actionsSource, /from '\.\/useLoginScreenControllerUiActions\.mjs'/);
  assert.match(actionsSource, /useLoginScreenControllerAuthActions\(/);
  assert.match(actionsSource, /useLoginScreenControllerUiActions\(/);
  assert.doesNotMatch(actionsSource, /submitLoginScreenNsec\(/);
  assert.doesNotMatch(actionsSource, /submitLoginScreenBunker\(/);
  assert.doesNotMatch(actionsSource, /submitLoginScreenCreateAccount\(/);
  assert.doesNotMatch(actionsSource, /createGeneratedLoginScreenAccount\(/);
  assert.doesNotMatch(actionsSource, /copyLoginScreenValue\(/);
  assert.doesNotMatch(actionsSource, /resetLoginScreenView\(/);
  assert.doesNotMatch(actionsSource, /stopLoginScreenQrSession\(/);
});
