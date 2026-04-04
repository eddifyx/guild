import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildChatViewIdentityVerificationInput,
  buildChatViewRuntimeValue,
  buildChatViewScrollRuntimeInput,
  buildChatViewTrustActionInput,
} from '../../../client/src/features/messaging/chatViewRuntimeInputs.mjs';

test('chat view runtime inputs preserve canonical identity, trust, scroll, and return contracts', () => {
  const identityInput = buildChatViewIdentityVerificationInput({
    effectiveConversation: { id: 'user-2', type: 'dm' },
    trustedNpub: 'npub1test',
    isE2EInitializedFn: () => true,
  });
  assert.equal(identityInput.effectiveConversation.id, 'user-2');
  assert.equal(identityInput.trustedNpub, 'npub1test');

  const setTrustSavingFn = () => {};
  const trustInput = buildChatViewTrustActionInput({
    effectiveConversation: { id: 'user-2', type: 'dm' },
    trustInput: 'npub1test',
    setTrustSavingFn,
    trustUserNpubFn: () => true,
  });
  assert.equal(trustInput.trustInput, 'npub1test');
  assert.equal(trustInput.setTrustSavingFn, setTrustSavingFn);

  const scrollRef = { current: {} };
  const scrollInput = buildChatViewScrollRuntimeInput({
    scrollRef,
    messagesContentRef: { current: {} },
    wasAtBottomRef: { current: true },
    scrollingRef: { current: false },
    pendingInitialScrollRef: { current: false },
    initialScrollPinnedUntilRef: { current: 0 },
    scrollToBottomFn: () => {},
    scheduleInitialBottomReleaseFn: () => {},
  });
  assert.equal(scrollInput.scrollRef, scrollRef);

  const runtimeValue = buildChatViewRuntimeValue({
    effectiveConversation: { id: 'user-2', type: 'dm' },
    messages: [{ id: 'msg-1' }],
    loading: false,
    dmTrustRequired: true,
  });
  assert.equal(runtimeValue.messages[0].id, 'msg-1');
  assert.equal(runtimeValue.dmTrustRequired, true);
});
