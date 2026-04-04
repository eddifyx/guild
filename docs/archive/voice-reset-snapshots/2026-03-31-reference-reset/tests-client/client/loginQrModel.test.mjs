import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LOGIN_QR_ADVANCED_LABEL,
  LOGIN_QR_BUNKER_HINT,
  LOGIN_QR_COPY_URI_LABEL,
  LOGIN_QR_HIDE_ADVANCED_LABEL,
  LOGIN_QR_HIDE_BUNKER_LABEL,
  LOGIN_QR_INSTALL_HINT,
  LOGIN_QR_OPEN_APPROVAL_LABEL,
  LOGIN_QR_REFRESH_LABEL,
  LOGIN_QR_SIGNER_LINKS,
  LOGIN_QR_USE_BUNKER_LABEL,
} from '../../../client/src/features/auth/loginQrModel.mjs';

test('login qr model exposes stable signer links and copy labels', () => {
  assert.deepEqual(LOGIN_QR_SIGNER_LINKS, [
    {
      label: 'Amber - Android',
      url: 'https://f-droid.org/packages/com.greenart7c3.nostrsigner/',
    },
    {
      label: 'Aegis - iOS',
      url: 'https://testflight.apple.com/join/DUzVMDMK',
    },
  ]);
  assert.equal(LOGIN_QR_INSTALL_HINT, 'Need a signer app first? Install one below, then come back and scan the QR code.');
  assert.equal(LOGIN_QR_BUNKER_HINT, 'Paste a `bunker://` URI or NIP-05 bunker identifier to connect directly without using this QR session.');
  assert.equal(LOGIN_QR_OPEN_APPROVAL_LABEL, 'Open approval link');
  assert.equal(LOGIN_QR_REFRESH_LABEL, 'Refresh QR');
  assert.equal(LOGIN_QR_ADVANCED_LABEL, 'Advanced');
  assert.equal(LOGIN_QR_HIDE_ADVANCED_LABEL, 'Hide advanced');
  assert.equal(LOGIN_QR_COPY_URI_LABEL, 'Copy QR URI');
  assert.equal(LOGIN_QR_USE_BUNKER_LABEL, 'Use bunker URI');
  assert.equal(LOGIN_QR_HIDE_BUNKER_LABEL, 'Hide bunker URI');
});
