import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('auth provider controller session support owns merge, stage, sync, and clear-local-session helpers', async () => {
  const supportSource = await readFile(
    new URL('../../../client/src/features/auth/useAuthProviderControllerSessionSupport.mjs', import.meta.url),
    'utf8'
  );

  assert.match(supportSource, /function useAuthProviderControllerSessionSupport\(/);
  assert.match(supportSource, /applyMergedSessionUser\(/);
  assert.match(supportSource, /stageAuthenticatedSession\(/);
  assert.match(supportSource, /syncSessionNostrProfile\(/);
  assert.match(supportSource, /clearLocalSessionState\(/);
});
