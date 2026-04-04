import test from 'node:test';
import assert from 'node:assert/strict';

import { SECURE_STARTUP_EVENT } from '../../../client/src/features/auth/secureStartupState.mjs';
import {
  E2E_INIT_READY_EVENT,
  emitE2EInitReady,
  ensureCompletedSecureLogin,
  initializeSecureSessionAttempt,
  isDeferredBundleAttestationError,
} from '../../../client/src/features/auth/secureSessionFlow.mjs';

test('emitE2EInitReady dispatches the canonical secure-init success event', () => {
  const dispatched = [];
  globalThis.window = {
    dispatchEvent: (event) => dispatched.push(event),
  };

  emitE2EInitReady();

  assert.equal(dispatched.length, 1);
  assert.equal(dispatched[0].type, E2E_INIT_READY_EVENT);

  delete globalThis.window;
});

test('isDeferredBundleAttestationError matches the attestation retry path', () => {
  assert.equal(
    isDeferredBundleAttestationError(new Error('Timed out waiting for Signal bundle attestation signature')),
    true,
  );
  assert.equal(
    isDeferredBundleAttestationError(new Error('Some other startup failure')),
    false,
  );
});

test('initializeSecureSessionAttempt retries deferred attestation once when signer is available', async () => {
  const dispatches = [];
  const readySignals = [];
  let attempts = 0;

  const result = await initializeSecureSessionAttempt({ userId: 'user-1' }, {
    attemptId: 1,
    getCurrentAttemptId: () => 1,
    initializeCryptoIdentity: async (_authData, options) => {
      attempts += 1;
      if (attempts === 1) {
        assert.equal(options.allowDeferredBundleAttestation, false);
        throw new Error('Timed out waiting for Signal bundle attestation signature');
      }
      assert.equal(options.allowDeferredBundleAttestation, true);
    },
    getSigner: () => ({ type: 'remote-signer' }),
    dispatchCryptoState: (event) => dispatches.push(event),
    onInitReady: () => readySignals.push('ready'),
  });

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(dispatches, [
    { type: SECURE_STARTUP_EVENT.START },
    { type: SECURE_STARTUP_EVENT.READY },
  ]);
  assert.deepEqual(readySignals, ['ready']);
});

test('initializeSecureSessionAttempt auto-restores a persisted signer before secure init', async () => {
  const dispatches = [];
  let reconnectCalls = 0;
  let signerAvailable = false;

  const result = await initializeSecureSessionAttempt({ userId: 'user-1' }, {
    attemptId: 1,
    getCurrentAttemptId: () => 1,
    reconnectSigner: async () => {
      reconnectCalls += 1;
      signerAvailable = true;
      return true;
    },
    initializeCryptoIdentity: async (_authData, options) => {
      assert.equal(options.allowDeferredBundleAttestation, false);
    },
    getSigner: () => (signerAvailable ? { type: 'restored-signer' } : null),
    dispatchCryptoState: (event) => dispatches.push(event),
  });

  assert.deepEqual(result, { ok: true });
  assert.equal(reconnectCalls, 1);
  assert.deepEqual(dispatches, [
    { type: SECURE_STARTUP_EVENT.START },
    { type: SECURE_STARTUP_EVENT.READY },
  ]);
});

test('initializeSecureSessionAttempt continues with deferred attestation when automatic signer restore is unavailable', async () => {
  const dispatches = [];
  let reconnectCalls = 0;

  const result = await initializeSecureSessionAttempt({ userId: 'user-1' }, {
    attemptId: 1,
    getCurrentAttemptId: () => 1,
    reconnectSigner: async () => {
      reconnectCalls += 1;
      return false;
    },
    initializeCryptoIdentity: async (_authData, options) => {
      assert.equal(options.allowDeferredBundleAttestation, true);
    },
    getSigner: () => null,
    dispatchCryptoState: (event) => dispatches.push(event),
  });

  assert.deepEqual(result, { ok: true });
  assert.equal(reconnectCalls, 1);
  assert.deepEqual(dispatches, [
    { type: SECURE_STARTUP_EVENT.START },
    { type: SECURE_STARTUP_EVENT.READY },
  ]);
});

test('initializeSecureSessionAttempt blocks when signer reconnect fails', async () => {
  const dispatches = [];
  const failures = [];

  const result = await initializeSecureSessionAttempt({ userId: 'user-1' }, {
    attemptId: 1,
    getCurrentAttemptId: () => 1,
    shouldReconnect: true,
    reconnectSigner: async () => false,
    dispatchCryptoState: (event) => dispatches.push(event),
    onInitFailed: (message) => failures.push(message),
  });

  assert.deepEqual(result, {
    ok: false,
    error: 'Nostr signer unavailable. Reconnect your signer to restore secure messaging.',
  });
  assert.deepEqual(dispatches, [
    { type: SECURE_STARTUP_EVENT.START },
    {
      type: SECURE_STARTUP_EVENT.BLOCKED,
      error: 'Nostr signer unavailable. Reconnect your signer to restore secure messaging.',
    },
  ]);
  assert.deepEqual(failures, [
    'Nostr signer unavailable. Reconnect your signer to restore secure messaging.',
  ]);
});

test('ensureCompletedSecureLogin promotes a timed-out startup into background success', async () => {
  const dispatches = [];
  const traces = [];
  let resolveStartup;
  const startupPromise = new Promise((resolve) => {
    resolveStartup = resolve;
  });

  await ensureCompletedSecureLogin({ npub: 'npub1builder' }, {
    initializeSecureSession: () => startupPromise,
    dispatchCryptoState: (event) => dispatches.push(event),
    pushTrace: (name, payload, level = 'info') => traces.push([name, payload, level]),
    redactTraceValue: (value) => value ? '<redacted>' : null,
    timeoutMs: 0,
  });

  resolveStartup({ ok: true });
  await Promise.resolve();
  await Promise.resolve();

  assert.deepEqual(dispatches, [
    {
      type: SECURE_STARTUP_EVENT.BACKGROUND,
      error: 'Login succeeded, but secure messaging setup did not finish in time.',
    },
    { type: SECURE_STARTUP_EVENT.READY },
  ]);
  assert.deepEqual(traces, [
    ['secure_login.start', { npub: '<redacted>' }, 'info'],
    ['secure_login.timeout', {
      npub: '<redacted>',
      error: 'Login succeeded, but secure messaging setup did not finish in time.',
    }, 'warn'],
    ['secure_login.background_success', { npub: '<redacted>' }, 'info'],
  ]);
});

test('ensureCompletedSecureLogin throws when secure initialization reports a blocking error', async () => {
  const traces = [];

  await assert.rejects(() => ensureCompletedSecureLogin({ npub: 'npub1builder' }, {
    initializeSecureSession: async () => ({ ok: false, error: 'Signer missing' }),
    pushTrace: (name, payload, level = 'info') => traces.push([name, payload, level]),
    redactTraceValue: () => '<redacted>',
  }), /Signer missing/);

  assert.deepEqual(traces, [
    ['secure_login.start', { npub: '<redacted>' }, 'info'],
    ['secure_login.error', { error: 'Signer missing' }, 'error'],
  ]);
});
