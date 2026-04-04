import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createChatViewScrollHandler,
  createChatViewSendHandler,
  createChatViewTrustUiHandlers,
} from '../../../client/src/features/messaging/chatViewRuntimeHandlers.mjs';

test('chat view runtime handlers send messages and keep the feed pinned to bottom', async () => {
  const calls = [];
  const wasAtBottomRef = { current: false };
  const onSend = createChatViewSendHandler({
    sendMessageFn: async (content, attachments) => {
      calls.push([content, attachments]);
    },
    wasAtBottomRef,
  });

  await onSend('hello', [{ id: 'file-1' }]);

  assert.deepEqual(calls, [['hello', [{ id: 'file-1' }]]]);
  assert.equal(wasAtBottomRef.current, true);
});

test('chat view runtime handlers clear trust errors and toggle verification modal state canonically', () => {
  const calls = [];
  const handlers = createChatViewTrustUiHandlers({
    trustError: 'bad npub',
    setTrustInputFn: (value) => calls.push(['input', value]),
    setTrustErrorFn: (value) => calls.push(['error', value]),
    setShowVerifyModalFn: (value) => calls.push(['modal', value]),
    setKeyChangedFn: (value) => calls.push(['key', value]),
  });

  handlers.onTrustInputChange('npub1example');
  handlers.onOpenVerifyModal();
  handlers.onCloseVerifyModal();
  handlers.onVerifiedIdentity();

  assert.deepEqual(calls, [
    ['input', 'npub1example'],
    ['error', ''],
    ['modal', true],
    ['modal', false],
    ['key', false],
    ['modal', false],
  ]);
});

test('chat view runtime handlers release the initial bottom pin and preserve scroll position when loading older messages', async () => {
  const element = {
    scrollHeight: 200,
    scrollTop: 10,
    clientHeight: 100,
  };
  const scrollRef = { current: element };
  const wasAtBottomRef = { current: true };
  const scrollingRef = { current: false };
  const pendingOlderLoadIdRef = { current: 0 };
  const loadingOlderRef = { current: false };
  const pendingInitialScrollRef = { current: true };
  const released = [];

  const handleScroll = createChatViewScrollHandler({
    scrollRef,
    wasAtBottomRef,
    scrollingRef,
    pendingOlderLoadIdRef,
    loadingOlderRef,
    pendingInitialScrollRef,
    hasMore: true,
    loading: false,
    loadMoreFn: async () => {
      element.scrollHeight = 260;
    },
    releaseInitialBottomPinFn: () => {
      released.push('released');
      pendingInitialScrollRef.current = false;
    },
    requestAnimationFrameFn: (callback) => callback(),
  });

  handleScroll();
  await Promise.resolve();
  await Promise.resolve();

  assert.deepEqual(released, ['released']);
  assert.equal(element.scrollTop, 70);
  assert.equal(loadingOlderRef.current, false);
  assert.equal(pendingOlderLoadIdRef.current, 1);
  assert.equal(wasAtBottomRef.current, false);
});
