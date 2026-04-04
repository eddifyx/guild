import test from 'node:test';
import assert from 'node:assert/strict';

import { E2E_INIT_READY_EVENT } from '../../../client/src/features/auth/secureSessionFlow.mjs';
import { SIGNAL_SESSION_READY_EVENT } from '../../../client/src/features/crypto/signalSessionRuntime.mjs';
import { bindDMDecryptRetry } from '../../../client/src/features/messaging/messageDmDecryptRetryRuntime.mjs';

test('message DM decrypt retry runtime retries only for the active DM contact, secure-ready, and session-ready events', () => {
  const listeners = new Map();
  const windowObj = {
    addEventListener(event, handler) {
      listeners.set(event, handler);
    },
    removeEventListener(event) {
      listeners.delete(event);
    },
  };

  const calls = [];
  const cleanup = bindDMDecryptRetry({
    conversation: { type: 'dm', id: 'user-b' },
    retryFailedVisibleMessagesFn: () => calls.push('retry'),
    windowObj,
  });

  listeners.get('trusted-npub-updated')?.({ detail: { userId: 'user-c' } });
  listeners.get('trusted-npub-updated')?.({ detail: { userId: 'user-b' } });
  listeners.get('identity-verified')?.({ detail: { userId: 'user-b' } });
  listeners.get(SIGNAL_SESSION_READY_EVENT)?.({ detail: { userId: 'user-c' } });
  listeners.get(SIGNAL_SESSION_READY_EVENT)?.({ detail: { userId: 'user-b' } });
  listeners.get(E2E_INIT_READY_EVENT)?.();

  assert.deepEqual(calls, ['retry', 'retry', 'retry', 'retry']);

  cleanup();
  assert.equal(listeners.size, 0);
});
