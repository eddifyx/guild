import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getCreateAccountSubmitLabel,
  getCreateCopyStateColor,
  getCreateGenerateButtonLabel,
  getCreateImageButtonLabel,
  getCreateKeyPrimerToggleLabel,
  getGeneratedNsecToggleLabel,
} from '../../../client/src/features/auth/loginCreateModel.mjs';

test('login create model resolves stable toggle and button labels', () => {
  assert.equal(getCreateKeyPrimerToggleLabel(false), 'How does this account work?');
  assert.equal(getCreateKeyPrimerToggleLabel(true), 'Hide account explainer');
  assert.equal(getCreateImageButtonLabel(null), 'Choose profile image');
  assert.equal(getCreateImageButtonLabel({ name: 'avatar.png' }), 'Change profile image');
  assert.equal(getCreateGenerateButtonLabel(null), 'Generate Nostr Keys');
  assert.equal(getCreateGenerateButtonLabel({ npub: 'npub1' }), 'Generate New Keys');
  assert.equal(getGeneratedNsecToggleLabel(false), 'Show');
  assert.equal(getGeneratedNsecToggleLabel(true), 'Hide');
});

test('login create model resolves copy-state color and submit labels consistently', () => {
  assert.equal(getCreateCopyStateColor('Copy failed'), '#ff4757');
  assert.equal(getCreateCopyStateColor('npub copied'), 'rgba(64, 255, 64, 0.7)');
  assert.equal(getCreateAccountSubmitLabel(false), 'Use This Account in /guild');
  assert.equal(getCreateAccountSubmitLabel(true), 'Signing in...');
});

