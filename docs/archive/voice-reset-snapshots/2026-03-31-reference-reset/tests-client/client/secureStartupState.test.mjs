import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createSecureStartupState,
  CRYPTO_STATUS,
  deriveSecurityState,
  isSecureStartupTimeoutError,
  SECURE_STARTUP_EVENT,
  SECURE_STARTUP_TIMEOUT_MESSAGE,
  reduceSecureStartupState,
  SECURITY_STATE,
} from '../../../client/src/features/auth/secureStartupState.mjs';

test('createSecureStartupState boots when recoverable auth is present', () => {
  assert.deepEqual(createSecureStartupState({ hasStoredAuth: true }), {
    status: CRYPTO_STATUS.BOOTING,
    error: null,
  });
});

test('createSecureStartupState starts signed out without recoverable auth', () => {
  assert.deepEqual(createSecureStartupState({ hasStoredAuth: false }), {
    status: CRYPTO_STATUS.SIGNED_OUT,
    error: null,
  });
});

test('reduceSecureStartupState clears stale errors when startup restarts', () => {
  const nextState = reduceSecureStartupState({
    status: CRYPTO_STATUS.BLOCKED,
    error: 'Signer missing',
  }, {
    type: SECURE_STARTUP_EVENT.START,
  });

  assert.deepEqual(nextState, {
    status: CRYPTO_STATUS.BOOTING,
    error: null,
  });
});

test('reduceSecureStartupState records background startup waits with a stable timeout message', () => {
  const nextState = reduceSecureStartupState(createSecureStartupState({
    hasStoredAuth: true,
  }), {
    type: SECURE_STARTUP_EVENT.BACKGROUND,
  });

  assert.deepEqual(nextState, {
    status: CRYPTO_STATUS.BACKGROUND,
    error: SECURE_STARTUP_TIMEOUT_MESSAGE,
  });
});

test('deriveSecurityState keeps ready and background sessions unlocked', () => {
  assert.equal(deriveSecurityState({
    user: { userId: 'user-1' },
    cryptoStatus: CRYPTO_STATUS.READY,
  }), SECURITY_STATE.CRYPTO_READY);

  assert.equal(deriveSecurityState({
    user: { userId: 'user-1' },
    cryptoStatus: CRYPTO_STATUS.BACKGROUND,
  }), SECURITY_STATE.CRYPTO_READY);
});

test('deriveSecurityState blocks the app when secure startup is blocked', () => {
  assert.equal(deriveSecurityState({
    user: { userId: 'user-1' },
    cryptoStatus: CRYPTO_STATUS.BLOCKED,
  }), SECURITY_STATE.BLOCKED);
});

test('isSecureStartupTimeoutError only matches the canonical timeout message', () => {
  assert.equal(isSecureStartupTimeoutError(new Error(SECURE_STARTUP_TIMEOUT_MESSAGE)), true);
  assert.equal(isSecureStartupTimeoutError(new Error('Signer missing')), false);
});
