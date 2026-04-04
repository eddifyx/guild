import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('auth provider controller secure-session owner handles secure init, retry, and authenticated completion', async () => {
  const secureSessionSource = await readFile(
    new URL('../../../client/src/features/auth/useAuthProviderControllerSecureSession.mjs', import.meta.url),
    'utf8'
  );

  assert.match(secureSessionSource, /function useAuthProviderControllerSecureSession\(/);
  assert.match(secureSessionSource, /initializeSecureSessionAttempt\(/);
  assert.match(secureSessionSource, /ensureCompletedSecureLogin\(/);
  assert.match(secureSessionSource, /finalizeAuthenticatedLogin\(/);
  assert.match(secureSessionSource, /retryCryptoInitialization/);
  assert.match(secureSessionSource, /reconnectSigner: true/);
  assert.match(secureSessionSource, /completeAuthenticatedLogin/);
});
