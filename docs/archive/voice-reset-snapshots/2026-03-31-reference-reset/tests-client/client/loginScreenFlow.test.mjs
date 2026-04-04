import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildLoginScreenDerivedState,
  copyLoginScreenValue,
  createGeneratedLoginScreenAccount,
  handleLoginScreenCreateImageSelection,
  resetLoginScreenView,
  sanitizeLoginScreenCreateAccountErrorMessage,
  sanitizeLoginScreenNsecErrorMessage,
  stopLoginScreenQrSession,
  submitLoginScreenBunker,
  submitLoginScreenCreateAccount,
  submitLoginScreenNsec,
} from '../../../client/src/features/auth/loginScreenFlow.mjs';

test('login screen flow derives qr busy state and masked nsec consistently', () => {
  assert.deepEqual(
    buildLoginScreenDerivedState({
      loading: false,
      qrPhase: 'waiting_connection',
      generatedAccount: { nsec: 'nsec1abcdefghijklmnopqrstuvxyz0123456789' },
      createImagePreview: '',
      createPicture: 'https://example.com/pic.png',
    }),
    {
      qrBusy: true,
      maskedGeneratedNsec: 'nsec1abcdefg************************23456789',
      createAvatarPreview: 'https://example.com/pic.png',
    }
  );
});

test('login screen flow sanitizes nsec and create-account errors', () => {
  assert.equal(
    sanitizeLoginScreenNsecErrorMessage(new Error('Invalid nsec checksum')),
    'Invalid key — please check for typos and try again.'
  );
  assert.equal(
    sanitizeLoginScreenCreateAccountErrorMessage(new Error('profile picture must be an http(s) url')),
    'Profile picture URL must start with http:// or https://'
  );
});

test('login screen flow resets view state and can stop the qr session', () => {
  const calls = [];
  const abortRef = {
    current: {
      abort() {
        calls.push('abort');
      },
    },
  };

  resetLoginScreenView({
    nextView: 'qr',
    setErrorFn: (value) => calls.push(['error', value]),
    setLoadingFn: (value) => calls.push(['loading', value]),
    setCreateCopyStateFn: (value) => calls.push(['copy', value]),
    setQrPhaseFn: (value) => calls.push(['phase', value]),
    setQrUriCopyStateFn: (value) => calls.push(['uri', value]),
    setShowQrAdvancedFn: (value) => calls.push(['advanced', value]),
    setShowBunkerInputFn: (value) => calls.push(['bunker', value]),
    setBunkerInputFn: (value) => calls.push(['bunkerInput', value]),
    setViewFn: (value) => calls.push(['view', value]),
  });

  stopLoginScreenQrSession({
    abortRef,
    setQrPhaseFn: (value) => calls.push(['stopPhase', value]),
  });

  assert.deepEqual(calls, [
    ['error', ''],
    ['loading', false],
    ['copy', ''],
    ['phase', 'idle'],
    ['uri', ''],
    ['advanced', false],
    ['bunker', false],
    ['bunkerInput', ''],
    ['view', 'qr'],
    'abort',
    ['stopPhase', 'idle'],
  ]);
  assert.equal(abortRef.current, null);
});

test('login screen flow creates accounts and validates image selections', () => {
  const account = createGeneratedLoginScreenAccount({
    generateSecretKeyFn: () => 'secret',
    getPublicKeyFn: () => 'pubkey',
    nip19Object: {
      nsecEncode: (value) => `nsec:${value}`,
      npubEncode: (value) => `npub:${value}`,
    },
  });

  assert.deepEqual(account, { nsec: 'nsec:secret', npub: 'npub:pubkey' });

  let imageError = null;
  let selectedFile = null;
  const oversizedEvent = {
    target: {
      files: [{ name: 'big.png', size: 11 * 1024 * 1024 }],
      value: 'something',
    },
  };
  const validEvent = {
    target: {
      files: [{ name: 'ok.png', size: 1024 }],
      value: 'something',
    },
  };

  assert.equal(
    handleLoginScreenCreateImageSelection({
      event: oversizedEvent,
      setErrorFn: (value) => {
        imageError = value;
      },
      setCreateImageFileFn: (value) => {
        selectedFile = value;
      },
    }),
    false
  );
  assert.equal(imageError, 'Profile image must be under 10MB');
  assert.equal(oversizedEvent.target.value, '');

  assert.equal(
    handleLoginScreenCreateImageSelection({
      event: validEvent,
      setErrorFn: (value) => {
        imageError = value;
      },
      setCreateImageFileFn: (value) => {
        selectedFile = value;
      },
    }),
    true
  );
  assert.equal(imageError, '');
  assert.deepEqual(selectedFile, { name: 'ok.png', size: 1024 });
});

test('login screen flow copies values and submits nsec, bunker, and create-account flows', async () => {
  const copyStates = [];
  const copied = await copyLoginScreenValue({
    value: 'nsec1abc',
    successLabel: 'copied',
    writeTextFn: async () => {},
    setCopyStateFn: (value) => copyStates.push(value),
  });
  const copyFailed = await copyLoginScreenValue({
    value: 'nsec1abc',
    successLabel: 'copied',
    writeTextFn: async () => {
      throw new Error('nope');
    },
    setCopyStateFn: (value) => copyStates.push(value),
  });

  let loading = [];
  let errors = [];
  let serverSet = [];
  let loginSuccess = 0;

  const nsecSubmitted = await submitLoginScreenNsec({
    value: 'nsec1abc',
    server: 'https://prod.example.com',
    getServerUrlFn: () => 'https://old.example.com',
    setServerUrlFn: (value) => serverSet.push(value),
    nsecLoginFn: async () => {},
    onLoginSuccessFn: () => { loginSuccess += 1; },
    setLoadingFn: (value) => loading.push(value),
    setErrorFn: (value) => errors.push(value),
  });

  let stopped = 0;
  const bunkerSubmitted = await submitLoginScreenBunker({
    bunkerInput: 'bunker://remote',
    stopQrSessionFn: () => { stopped += 1; },
    setLoadingFn: (value) => loading.push(value),
    setErrorFn: (value) => errors.push(value),
    setAuthChallengeUrlFn: (value) => errors.push(`challenge:${value}`),
    server: 'https://prod.example.com',
    getServerUrlFn: () => 'https://prod.example.com',
    setServerUrlFn: (value) => serverSet.push(value),
    nostrLoginFn: async () => {},
    onLoginSuccessFn: () => { loginSuccess += 1; },
  });

  const created = await submitLoginScreenCreateAccount({
    generatedAccount: { nsec: 'nsec1created' },
    server: 'https://prod.example.com',
    getServerUrlFn: () => 'https://prod.example.com',
    setServerUrlFn: (value) => serverSet.push(value),
    createAccountFn: async () => {},
    profile: { name: 'Scout' },
    profileImageFile: { name: 'pic.png' },
    onLoginSuccessFn: () => { loginSuccess += 1; },
    setLoadingFn: (value) => loading.push(value),
    setErrorFn: (value) => errors.push(value),
  });

  assert.equal(copied, true);
  assert.equal(copyFailed, false);
  assert.deepEqual(copyStates, ['copied', 'Copy failed']);
  assert.equal(nsecSubmitted, true);
  assert.equal(bunkerSubmitted, true);
  assert.equal(created, true);
  assert.equal(stopped, 1);
  assert.equal(loginSuccess, 3);
  assert.deepEqual(serverSet, ['https://prod.example.com']);
  assert.deepEqual(errors, ['', '', 'challenge:', '']);
  assert.deepEqual(loading, [true, false, true, false, true, false]);
});
