import test from 'node:test';
import assert from 'node:assert/strict';

import { createTrustContactAction } from '../../../client/src/features/messaging/chatViewTrustFlow.mjs';

test('chat view trust flow validates npubs and saves trusted identities for matching users', async () => {
  const calls = [];
  let trustSaving = false;
  let trustError = '';
  let trustedNpub = null;
  let trustInput = '';

  const handleTrustContact = createTrustContactAction({
    effectiveConversation: { type: 'dm', id: 'user-2', dmUnsupported: false },
    trustInput: 'npub1valid',
    setTrustSavingFn: (value) => {
      trustSaving = value;
      calls.push(['setTrustSaving', value]);
    },
    setTrustErrorFn: (value) => {
      trustError = value;
      calls.push(['setTrustError', value]);
    },
    setTrustedNpubFn: (value) => {
      trustedNpub = value;
      calls.push(['setTrustedNpub', value]);
    },
    setTrustInputFn: (value) => {
      trustInput = value;
      calls.push(['setTrustInput', value]);
    },
    lookupUserByNpubFn: async () => ({ id: 'user-2' }),
    trustUserNpubFn: () => true,
  });

  const result = await handleTrustContact();

  assert.equal(result, true);
  assert.equal(trustSaving, false);
  assert.equal(trustError, '');
  assert.equal(trustedNpub, 'npub1valid');
  assert.equal(trustInput, 'npub1valid');
});

test('chat view trust flow rejects invalid, mismatched, and conflicting npubs', async () => {
  const errors = [];

  const invalidNpubAction = createTrustContactAction({
    effectiveConversation: { type: 'dm', id: 'user-2', dmUnsupported: false },
    trustInput: 'hexpub',
    setTrustSavingFn: () => {},
    setTrustErrorFn: (value) => errors.push(value),
    setTrustedNpubFn: () => {},
    setTrustInputFn: () => {},
    lookupUserByNpubFn: async () => ({ id: 'user-2' }),
    trustUserNpubFn: () => true,
  });
  assert.equal(await invalidNpubAction(), false);

  const mismatchedAction = createTrustContactAction({
    effectiveConversation: { type: 'dm', id: 'user-2', dmUnsupported: false },
    trustInput: 'npub1mismatch',
    setTrustSavingFn: () => {},
    setTrustErrorFn: (value) => errors.push(value),
    setTrustedNpubFn: () => {},
    setTrustInputFn: () => {},
    lookupUserByNpubFn: async () => ({ id: 'user-9' }),
    trustUserNpubFn: () => true,
  });
  assert.equal(await mismatchedAction(), false);

  const conflictingAction = createTrustContactAction({
    effectiveConversation: { type: 'dm', id: 'user-2', dmUnsupported: false },
    trustInput: 'npub1conflict',
    setTrustSavingFn: () => {},
    setTrustErrorFn: (value) => errors.push(value),
    setTrustedNpubFn: () => {},
    setTrustInputFn: () => {},
    lookupUserByNpubFn: async () => ({ id: 'user-2' }),
    trustUserNpubFn: () => false,
  });
  assert.equal(await conflictingAction(), false);

  assert.equal(errors.some((message) => /valid npub/i.test(message)), true);
  assert.equal(errors.some((message) => /different account/i.test(message)), true);
  assert.equal(errors.some((message) => /different trusted npub/i.test(message)), true);
});
