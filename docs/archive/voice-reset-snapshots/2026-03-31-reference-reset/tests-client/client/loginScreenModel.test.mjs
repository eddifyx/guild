import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildLoginScreenFormState,
  getLoginScreenNsecSubmitLabel,
  getLoginScreenQrStatusMessage,
  getLoginScreenServerToggleLabel,
  shouldWarnInsecureLoginServer,
} from '../../../client/src/features/auth/loginScreenModel.mjs';

test('login screen model resolves qr status and insecure server warnings', () => {
  assert.equal(
    getLoginScreenQrStatusMessage({ qrPhase: 'waiting_connection', loading: false }),
    'Waiting for signer to connect...'
  );
  assert.equal(
    getLoginScreenQrStatusMessage({ qrPhase: 'finishing_login', loading: false }),
    'Finishing sign-in...'
  );
  assert.equal(shouldWarnInsecureLoginServer('http://guild.example.com'), true);
  assert.equal(shouldWarnInsecureLoginServer('http://localhost:3000'), false);
});

test('login screen model derives submit states and generated-account preview data', () => {
  assert.deepEqual(
    buildLoginScreenFormState({
      server: 'http://guild.example.com',
      loading: false,
      qrPhase: 'idle',
      generatedAccount: { nsec: 'nsec1abcdefghijklmnopqrstuvxyz0123456789' },
      createImagePreview: '',
      createPicture: 'https://example.com/pic.png',
      bunkerInput: 'bunker://abc',
      nsecInput: 'nsec1abc',
      connectURI: 'nostrconnect://abc',
    }),
    {
      qrBusy: false,
      qrStatusMessage: 'Open a signer app and scan this code',
      maskedGeneratedNsec: 'nsec1abcdefg************************23456789',
      createAvatarPreview: 'https://example.com/pic.png',
      canCopyQrUri: true,
      canSubmitBunker: true,
      canSubmitNsec: true,
      canSubmitCreateAccount: true,
      shouldWarnInsecureServer: true,
    }
  );
});

test('login screen model exposes stable view labels for server toggles and nsec submit state', () => {
  assert.equal(getLoginScreenServerToggleLabel(false), 'Server settings');
  assert.equal(getLoginScreenServerToggleLabel(true), 'Hide server settings');
  assert.equal(getLoginScreenNsecSubmitLabel(false), 'Connect');
  assert.equal(getLoginScreenNsecSubmitLabel(true), 'Connecting...');
});
