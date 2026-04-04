import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildUseMessagesFlowContracts,
  buildUseMessagesRuntimeContracts,
} from '../../../client/src/features/messaging/messageControllerContracts.mjs';

test('message controller flow contracts defer room committed logs onto requestAnimationFrame', async () => {
  const calls = [];
  const originalWindow = globalThis.window;
  globalThis.window = {
    requestAnimationFrame(callback) {
      calls.push('raf');
      callback();
    },
  };

  try {
    const flows = buildUseMessagesFlowContracts({
      conversation: { type: 'room' },
      debugRoomOpenLogFn: (phase, details) => calls.push([phase, details]),
    });

    flows.debugRoomOpenLogFn('messages-committed', { count: 1 });

    assert.deepEqual(calls, ['raf', ['messages-committed', { count: 1 }]]);
  } finally {
    globalThis.window = originalWindow;
  }
});

test('message controller runtime contracts build clear-all cache handling through shared dependencies', () => {
  const calls = [];
  const runtime = buildUseMessagesRuntimeContracts({
    clearAllMessageCachesFn: (options) => calls.push(options),
    clearDecryptedMessageCachesFn: 'clearDecrypted',
    clearConversationCacheStateFn: 'clearConversation',
    clearMessageDecryptRuntimeFn: 'clearDecryptRuntime',
    revokeAttachmentPreviewUrlsFn: 'revokePreviewUrls',
  });

  runtime.clearAllMessageCachesFn();

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    clearDecryptedMessageCachesFn: 'clearDecrypted',
    clearConversationCacheStateFn: 'clearConversation',
    clearMessageDecryptRuntimeFn: 'clearDecryptRuntime',
    revokeAttachmentPreviewUrlsFn: 'revokePreviewUrls',
  });
});
