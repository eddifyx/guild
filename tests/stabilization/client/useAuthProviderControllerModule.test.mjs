import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('auth provider controller delegates state and composition to dedicated owners', async () => {
  const controllerSource = await readFile(
    new URL('../../../client/src/features/auth/useAuthProviderController.mjs', import.meta.url),
    'utf8'
  );
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
  const stateSource = await readFile(
    new URL('../../../client/src/features/auth/useAuthProviderControllerState.mjs', import.meta.url),
    'utf8'
  );

  assert.match(controllerSource, /from '\.\/useAuthProviderControllerComposition\.mjs'/);
  assert.match(controllerSource, /from '\.\/useAuthProviderControllerState\.mjs'/);
  assert.match(controllerSource, /useAuthProviderControllerState\(/);
  assert.match(controllerSource, /useAuthProviderControllerComposition\(/);
  assert.doesNotMatch(controllerSource, /useAuthRuntimeEffects\(/);
  assert.doesNotMatch(controllerSource, /createAuthActions\(/);
  assert.doesNotMatch(controllerSource, /ensureCompletedSecureLogin\(/);
  assert.doesNotMatch(controllerSource, /restoreInitialSessionUser\(/);
  assert.match(compositionSource, /function useAuthProviderControllerComposition\(/);
  assert.match(compositionSource, /useAuthProviderControllerSessionRuntime\(/);
  assert.match(compositionSource, /useAuthProviderControllerActions\(/);
  assert.match(sessionRuntimeSource, /function useAuthProviderControllerSessionRuntime\(/);
  assert.match(sessionRuntimeSource, /useAuthProviderControllerSessionSupport\(/);
  assert.match(sessionRuntimeSource, /useAuthProviderControllerSecureSession\(/);
  assert.match(supportSource, /function useAuthProviderControllerSessionSupport\(/);
  assert.match(secureSessionSource, /function useAuthProviderControllerSecureSession\(/);
  assert.match(actionsSource, /function useAuthProviderControllerActions\(/);
  assert.match(stateSource, /function useAuthProviderControllerState\(/);
});
