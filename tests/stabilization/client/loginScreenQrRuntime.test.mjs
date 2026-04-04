import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createLoginScreenAuthChallengeHandler,
  resolveLoginScreenQrErrorMessage,
  startLoginScreenQrSession,
} from '../../../client/src/features/auth/loginScreenQrRuntime.mjs';

test('login screen qr runtime resolves canonical qr error messages', () => {
  assert.equal(
    resolveLoginScreenQrErrorMessage(new Error('subscription closed before connection was established')),
    'QR session expired before the signer connected. Refresh the code and scan again.'
  );
  assert.equal(
    resolveLoginScreenQrErrorMessage(new Error('whatever'), { timedOut: true }),
    'Signer did not connect to this QR code in time. Refresh the QR and scan again.'
  );
  assert.equal(
    resolveLoginScreenQrErrorMessage(new Error('cancelled by user')),
    ''
  );
});

test('login screen qr runtime challenge handler stores the approval url and message', () => {
  const calls = [];
  const handler = createLoginScreenAuthChallengeHandler({
    setAuthChallengeUrlFn: (value) => calls.push(['url', value]),
    setErrorFn: (value) => calls.push(['error', value]),
  });

  assert.equal(handler({ detail: { url: 'https://approve.example.com' } }), true);
  assert.deepEqual(calls, [
    ['url', 'https://approve.example.com'],
    ['error', 'Your signer requires an additional approval step before it can sign in.'],
  ]);
});

test('login screen qr runtime starts, connects, completes login, and cleans up', async () => {
  const calls = [];
  const abortRef = { current: null };
  const timers = [];
  let connected = null;

  class FakeAbortController {
    constructor() {
      this.signal = { aborted: false };
    }
    abort() {
      this.signal.aborted = true;
      calls.push('abort');
    }
  }

  const cleanup = startLoginScreenQrSession({
    server: 'https://prod.example.com',
    getServerUrlFn: () => 'https://old.example.com',
    setServerUrlFn: (value) => calls.push(['server', value]),
    clearNip46TraceFn: (value) => calls.push(['trace', value]),
    abortRef,
    AbortControllerClass: FakeAbortController,
    setTimeoutFn: (callback, ms) => {
      timers.push({ callback, ms });
      return 'timeout-id';
    },
    clearTimeoutFn: (value) => calls.push(['clearTimeout', value]),
    createNostrConnectSessionFn: ({ onConnected, abortSignal }) => {
      connected = onConnected;
      assert.equal(abortSignal.aborted, false);
      return {
        uri: 'nostrconnect://session',
        waitForConnection: async () => ({ bunker: 'ready' }),
      };
    },
    nostrConnectLoginFn: async (value) => calls.push(['login', value]),
    onLoginSuccessFn: () => calls.push(['success']),
    setLoadingFn: (value) => calls.push(['loading', value]),
    setConnectURIFn: (value) => calls.push(['uri', value]),
    setErrorFn: (value) => calls.push(['error', value]),
    setAuthChallengeUrlFn: (value) => calls.push(['authUrl', value]),
    setQrPhaseFn: (value) => calls.push(['phase', value]),
    setQrUriCopyStateFn: (value) => calls.push(['copy', value]),
    setShowQrAdvancedFn: (value) => calls.push(['advanced', value]),
    setShowBunkerInputFn: (value) => calls.push(['bunker', value]),
  });

  connected();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();

  cleanup();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(typeof cleanup, 'function');
  assert.equal(timers[0].ms, 45_000);
  assert.deepEqual(calls.slice(0, 17), [
    ['server', 'https://prod.example.com'],
    ['trace', 'qr_view_started'],
    ['loading', false],
    ['uri', ''],
    ['error', ''],
    ['authUrl', ''],
    ['phase', 'waiting_connection'],
    ['copy', ''],
    ['advanced', false],
    ['bunker', false],
    ['uri', 'nostrconnect://session'],
    ['clearTimeout', 'timeout-id'],
    ['loading', true],
    ['phase', 'finishing_login'],
    ['clearTimeout', 'timeout-id'],
    ['loading', true],
    ['login', { bunker: 'ready' }],
  ]);
  assert.equal(calls.includes('abort'), true);
  assert.equal(calls.some((entry) => Array.isArray(entry) && entry[0] === 'success'), true);
  assert.equal(calls.some((entry) => Array.isArray(entry) && entry[0] === 'loading' && entry[1] === false), true);
  assert.equal(calls.some((entry) => Array.isArray(entry) && entry[0] === 'clearTimeout' && entry[1] === 'timeout-id'), true);
  assert.equal(abortRef.current, null);
});
