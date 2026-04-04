import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getChatViewMediaReadyReleaseDelayMs,
  getChatViewTrustBootstrapState,
  shouldKeepChatViewPinnedToBottom,
  shouldLoadChatViewIdentityVerification,
} from '../../../client/src/features/messaging/chatViewRuntimeModel.mjs';

test('chat view runtime model bootstraps trust state and identity verification gating', () => {
  const conversation = { type: 'dm', id: 'user-2' };
  const bootstrap = getChatViewTrustBootstrapState(conversation, (id) => (id === 'user-2' ? 'npub1trusted' : null));

  assert.deepEqual(bootstrap, {
    keyChanged: false,
    identityCheckError: '',
    trustedNpub: 'npub1trusted',
    trustInput: 'npub1trusted',
    trustError: '',
  });

  assert.equal(shouldLoadChatViewIdentityVerification({
    effectiveConversation: conversation,
    trustedNpub: bootstrap.trustedNpub,
    isE2EInitializedFn: () => true,
  }), true);

  assert.equal(shouldLoadChatViewIdentityVerification({
    effectiveConversation: { type: 'dm', id: 'user-2', dmUnsupported: true },
    trustedNpub: bootstrap.trustedNpub,
    isE2EInitializedFn: () => true,
  }), false);
});

test('chat view runtime model keeps the scroll pin and media release logic stable', () => {
  assert.equal(getChatViewMediaReadyReleaseDelayMs(0), 280);
  assert.equal(getChatViewMediaReadyReleaseDelayMs(4), 2200);
  assert.equal(getChatViewMediaReadyReleaseDelayMs(10), 2600);

  assert.equal(shouldKeepChatViewPinnedToBottom({
    wasAtBottom: false,
    scrolling: false,
    pendingInitialScroll: true,
    initialScrollPinnedUntil: 0,
    now: 10,
  }), true);

  assert.equal(shouldKeepChatViewPinnedToBottom({
    wasAtBottom: false,
    scrolling: false,
    pendingInitialScroll: false,
    initialScrollPinnedUntil: 100,
    now: 50,
  }), true);

  assert.equal(shouldKeepChatViewPinnedToBottom({
    wasAtBottom: false,
    scrolling: false,
    pendingInitialScroll: false,
    initialScrollPinnedUntil: 100,
    now: 150,
  }), false);
});
