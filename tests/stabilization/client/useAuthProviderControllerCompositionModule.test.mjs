import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('auth provider controller composition owns secure-session effects and action orchestration', async () => {
  const compositionSource = await readFile(
    new URL('../../../client/src/features/auth/useAuthProviderControllerComposition.mjs', import.meta.url),
    'utf8'
  );
  const sessionRuntimeSource = await readFile(
    new URL('../../../client/src/features/auth/useAuthProviderControllerSessionRuntime.mjs', import.meta.url),
    'utf8'
  );
  const supportSource = await readFile(
    new URL('../../../client/src/features/auth/useAuthProviderControllerSessionSupport.mjs', import.meta.url),
    'utf8'
  );
  const secureSessionSource = await readFile(
    new URL('../../../client/src/features/auth/useAuthProviderControllerSecureSession.mjs', import.meta.url),
    'utf8'
  );
  const actionsSource = await readFile(
    new URL('../../../client/src/features/auth/useAuthProviderControllerActions.mjs', import.meta.url),
    'utf8'
  );

  assert.match(compositionSource, /function useAuthProviderControllerComposition\(/);
  assert.match(compositionSource, /useAuthProviderControllerSessionRuntime\(/);
  assert.match(compositionSource, /useAuthProviderControllerActions\(/);
  assert.doesNotMatch(compositionSource, /useAuthRuntimeEffects\(/);
  assert.doesNotMatch(compositionSource, /initializeSecureSessionAttempt\(/);
  assert.doesNotMatch(compositionSource, /ensureCompletedSecureLogin\(/);
  assert.doesNotMatch(compositionSource, /stageAuthenticatedSession\(/);
  assert.doesNotMatch(compositionSource, /finalizeAuthenticatedLogin\(/);
  assert.doesNotMatch(compositionSource, /syncSessionNostrProfile\(/);
  assert.doesNotMatch(compositionSource, /createAuthActions\(/);
  assert.doesNotMatch(compositionSource, /logoutSession\(/);
  assert.match(sessionRuntimeSource, /useAuthRuntimeEffects\(/);
  assert.match(sessionRuntimeSource, /useAuthProviderControllerSessionSupport\(/);
  assert.match(sessionRuntimeSource, /useAuthProviderControllerSecureSession\(/);
  assert.match(supportSource, /stageAuthenticatedSession\(/);
  assert.match(supportSource, /syncSessionNostrProfile\(/);
  assert.match(secureSessionSource, /initializeSecureSessionAttempt\(/);
  assert.match(secureSessionSource, /ensureCompletedSecureLogin\(/);
  assert.match(secureSessionSource, /finalizeAuthenticatedLogin\(/);
  assert.match(actionsSource, /createAuthActions\(/);
  assert.match(actionsSource, /logoutSession\(/);
});
