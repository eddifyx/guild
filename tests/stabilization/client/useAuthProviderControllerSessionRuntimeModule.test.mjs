import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('auth provider controller session runtime owns secure-session orchestration and auth runtime effects', async () => {
  const sessionRuntimeSource = await readFile(
    new URL('../../../client/src/features/auth/useAuthProviderControllerSessionRuntime.mjs', import.meta.url),
    'utf8'
  );

  assert.match(sessionRuntimeSource, /function useAuthProviderControllerSessionRuntime\(/);
  assert.match(sessionRuntimeSource, /useAuthProviderControllerSessionSupport\(/);
  assert.match(sessionRuntimeSource, /useAuthProviderControllerSecureSession\(/);
  assert.match(sessionRuntimeSource, /useAuthRuntimeEffects\(/);
  assert.doesNotMatch(sessionRuntimeSource, /applyMergedSessionUser\(/);
  assert.doesNotMatch(sessionRuntimeSource, /stageAuthenticatedSession\(/);
  assert.doesNotMatch(sessionRuntimeSource, /syncSessionNostrProfile\(/);
  assert.doesNotMatch(sessionRuntimeSource, /clearLocalSessionState\(/);
  assert.doesNotMatch(sessionRuntimeSource, /initializeSecureSessionAttempt\(/);
  assert.doesNotMatch(sessionRuntimeSource, /ensureCompletedSecureLogin\(/);
  assert.doesNotMatch(sessionRuntimeSource, /finalizeAuthenticatedLogin\(/);
});
