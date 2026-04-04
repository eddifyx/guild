import test from 'node:test';
import assert from 'node:assert/strict';

import { getConversationDecryptFailureMessage } from '../../../client/src/features/messaging/messageDecryptPresentation.mjs';

test('message decrypt presentation maps known buckets to actionable copy', () => {
  assert.equal(
    getConversationDecryptFailureMessage('missing-dm-copy'),
    'This secure message was not sent to this device'
  );
  assert.equal(
    getConversationDecryptFailureMessage('missing-sender-key'),
    'Secure room keys were unavailable for this message'
  );
  assert.equal(
    getConversationDecryptFailureMessage('missing-session'),
    'Secure session data was unavailable for this message'
  );
  assert.equal(
    getConversationDecryptFailureMessage('untrusted-identity'),
    'Identity verification is still required for this message'
  );
  assert.equal(
    getConversationDecryptFailureMessage('e2e-not-ready'),
    'Secure messaging was not ready for this message'
  );
  assert.equal(
    getConversationDecryptFailureMessage('other'),
    'Message could not be decrypted'
  );
});
