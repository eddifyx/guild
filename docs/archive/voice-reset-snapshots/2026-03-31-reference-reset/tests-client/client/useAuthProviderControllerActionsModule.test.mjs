import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('auth provider controller actions own auth action creation and logout assembly', async () => {
  const actionsSource = await readFile(
    new URL('../../../client/src/features/auth/useAuthProviderControllerActions.mjs', import.meta.url),
    'utf8'
  );

  assert.match(actionsSource, /function useAuthProviderControllerActions\(/);
  assert.match(actionsSource, /createAuthActions\(/);
  assert.match(actionsSource, /connectWithBunkerURI/);
  assert.match(actionsSource, /authenticateWithServer/);
  assert.match(actionsSource, /finalizeCreatedAccountProfile/);
  assert.match(actionsSource, /logoutSession\(/);
});
