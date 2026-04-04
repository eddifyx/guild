import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('auth provider controller delegates recoverable-auth bootstrap and reducer state to a dedicated state hook', async () => {
  const controllerSource = await readFile(
    new URL('../../../client/src/features/auth/useAuthProviderController.mjs', import.meta.url),
    'utf8'
  );
  const stateSource = await readFile(
    new URL('../../../client/src/features/auth/useAuthProviderControllerState.mjs', import.meta.url),
    'utf8'
  );

  assert.match(controllerSource, /from '\.\/useAuthProviderControllerState\.mjs'/);
  assert.match(controllerSource, /useAuthProviderControllerState\(/);
  assert.doesNotMatch(controllerSource, /useReducer\(/);
  assert.doesNotMatch(controllerSource, /useRef\(/);
  assert.doesNotMatch(controllerSource, /restoreInitialSessionUser\(/);

  assert.match(stateSource, /export const INITIAL_AUTH_UNSET = Symbol/);
  assert.match(stateSource, /function initializeAuthProviderInitialUser\(/);
  assert.match(stateSource, /restoreInitialSessionUserFn/);
  assert.match(stateSource, /const secureStartupAttemptRef = useRef\(0\)/);
  assert.match(stateSource, /const \[user, setUser\] = useState\(\(\) => initialUser\)/);
  assert.match(stateSource, /const \[cryptoState, dispatchCryptoState\] = useReducer\(/);
});
