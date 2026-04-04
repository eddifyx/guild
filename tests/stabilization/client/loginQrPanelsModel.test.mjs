import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildLoginQrAdvancedState,
  buildLoginQrInstallState,
  getLoginQrAdvancedToggleLabel,
  getLoginQrBunkerToggleLabel,
} from '../../../client/src/features/auth/loginQrPanelsModel.mjs';

test('login qr panels model builds stable install state from qr availability', () => {
  assert.deepEqual(
    buildLoginQrInstallState({
      connectURI: 'nostrconnect://example',
      qrStatusMessage: 'Scan now',
    }),
    {
      connectURI: 'nostrconnect://example',
      qrStatusMessage: 'Scan now',
      showQrCode: true,
    }
  );

  assert.deepEqual(buildLoginQrInstallState({ connectURI: '', qrStatusMessage: '' }), {
    connectURI: '',
    qrStatusMessage: '',
    showQrCode: false,
  });
});

test('login qr panels model derives advanced toggle, bunker toggle, and submit state consistently', () => {
  assert.equal(getLoginQrAdvancedToggleLabel(false), 'Advanced');
  assert.equal(getLoginQrAdvancedToggleLabel(true), 'Hide advanced');
  assert.equal(getLoginQrBunkerToggleLabel(false), 'Use bunker URI');
  assert.equal(getLoginQrBunkerToggleLabel(true), 'Hide bunker URI');

  assert.deepEqual(
    buildLoginQrAdvancedState({
      qrBusy: true,
      showQrAdvanced: true,
      canCopyQrUri: false,
      showBunkerInput: true,
      canSubmitBunker: false,
      loading: true,
      qrUriCopyState: 'Copied',
    }),
    {
      refreshDisabled: true,
      advancedToggleLabel: 'Hide advanced',
      copyDisabled: true,
      bunkerToggleLabel: 'Hide bunker URI',
      submitDisabled: true,
      submitLabel: 'Connecting...',
      qrUriCopyState: 'Copied',
      showCopyState: true,
    }
  );
});
