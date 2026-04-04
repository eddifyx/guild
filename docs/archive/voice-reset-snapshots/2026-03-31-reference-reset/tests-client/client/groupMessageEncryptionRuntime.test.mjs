import test from 'node:test';
import assert from 'node:assert/strict';

import { createGroupMessageEncryptionRuntime } from '../../../client/src/features/crypto/groupMessageEncryptionRuntime.mjs';

test('group message encryption runtime delegates encrypt and decrypt through the sender-key module', async () => {
  const calls = [];
  const runtime = createGroupMessageEncryptionRuntime({
    isE2EInitializedFn: () => true,
    importSenderKeysModuleFn: async () => ({
      encryptWithSenderKey: async (...args) => {
        calls.push(['encrypt', ...args]);
        return 'group-envelope';
      },
      decryptWithSenderKey: async (...args) => {
        calls.push(['decrypt', ...args]);
        return { body: 'group-plaintext' };
      },
    }),
  });

  assert.equal(await runtime.encryptGroupMessage('room-1', 'hi', [{ id: 'att-1' }]), 'group-envelope');
  assert.deepEqual(
    await runtime.decryptGroupMessage('room-1', 'peer-1', '{"v":2}'),
    { body: 'group-plaintext' }
  );
  assert.deepEqual(calls, [
    ['encrypt', 'room-1', 'hi', [{ id: 'att-1' }]],
    ['decrypt', 'room-1', 'peer-1', '{"v":2}'],
  ]);
});

test('group message encryption runtime blocks work when E2E is unavailable', async () => {
  const runtime = createGroupMessageEncryptionRuntime({
    isE2EInitializedFn: () => false,
  });

  await assert.rejects(
    runtime.encryptGroupMessage('room-2', 'nope'),
    /E2E encryption not initialized/
  );
  await assert.rejects(
    runtime.decryptGroupMessage('room-2', 'peer-2', '{}'),
    /E2E encryption not initialized/
  );
});
