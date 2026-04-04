import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AUTH_USER_UPDATED_EVENT,
  claimProfileSyncSession,
  dispatchAuthUserUpdated,
  getProfileSyncSessionKey,
  registerNostrAuthChallengeListener,
  registerSessionExpiredListener,
} from '../../../client/src/features/auth/authRuntimeEffects.mjs';

test('getProfileSyncSessionKey only returns a key for a fully recoverable session', () => {
  assert.equal(getProfileSyncSessionKey({
    userId: 'user-1',
    npub: 'npub1builder',
    token: 'token-1',
  }), 'user-1:token-1');

  assert.equal(getProfileSyncSessionKey({
    userId: 'user-1',
    npub: null,
    token: 'token-1',
  }), null);
});

test('claimProfileSyncSession only claims a session once and resets for invalid users', () => {
  const ref = { current: null };

  assert.equal(claimProfileSyncSession(ref, {
    userId: 'user-1',
    npub: 'npub1builder',
    token: 'token-1',
  }), true);
  assert.equal(ref.current, 'user-1:token-1');

  assert.equal(claimProfileSyncSession(ref, {
    userId: 'user-1',
    npub: 'npub1builder',
    token: 'token-1',
  }), false);
  assert.equal(ref.current, 'user-1:token-1');

  assert.equal(claimProfileSyncSession(ref, {
    userId: 'user-1',
    npub: null,
    token: 'token-1',
  }), false);
  assert.equal(ref.current, null);
});

test('dispatchAuthUserUpdated emits the canonical auth-user event', () => {
  const events = [];
  const OriginalCustomEvent = globalThis.CustomEvent;

  class TestCustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  }

  globalThis.CustomEvent = TestCustomEvent;
  try {
    const dispatched = dispatchAuthUserUpdated({
      userId: 'user-1',
      username: 'Builder',
    }, {
      dispatchEvent(event) {
        events.push(event);
      },
    });

    assert.equal(dispatched, true);
    assert.deepEqual(events.map((event) => ({
      type: event.type,
      detail: event.detail,
    })), [{
      type: AUTH_USER_UPDATED_EVENT,
      detail: {
        userId: 'user-1',
        username: 'Builder',
      },
    }]);
  } finally {
    globalThis.CustomEvent = OriginalCustomEvent;
  }
});

test('registerSessionExpiredListener delegates to clearLocalSession and unregisters cleanly', async () => {
  const listeners = new Map();
  const calls = [];
  const eventTarget = {
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    removeEventListener(type, handler) {
      if (listeners.get(type) === handler) {
        listeners.delete(type);
      }
    },
  };

  const cleanup = registerSessionExpiredListener(async () => {
    calls.push('cleared');
  }, eventTarget);

  listeners.get('session-expired')?.();
  await Promise.resolve();
  assert.deepEqual(calls, ['cleared']);

  cleanup();
  assert.equal(listeners.has('session-expired'), false);
});

test('registerNostrAuthChallengeListener opens signer approval links and dedupes rapid repeats', () => {
  const listeners = new Map();
  const opened = [];
  let now = 1000;
  const eventTarget = {
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    removeEventListener(type, handler) {
      if (listeners.get(type) === handler) {
        listeners.delete(type);
      }
    },
  };

  const cleanup = registerNostrAuthChallengeListener({
    eventTarget,
    getAuthChallengeEventNameFn: () => 'nostr-connect-auth-challenge',
    openExternalFn: (url) => opened.push(url),
    nowFn: () => now,
  });

  listeners.get('nostr-connect-auth-challenge')?.({
    detail: { url: 'https://signer.example/approve' },
  });
  listeners.get('nostr-connect-auth-challenge')?.({
    detail: { url: 'https://signer.example/approve' },
  });
  now += 6000;
  listeners.get('nostr-connect-auth-challenge')?.({
    detail: { url: 'https://signer.example/approve' },
  });

  assert.deepEqual(opened, [
    'https://signer.example/approve',
    'https://signer.example/approve',
  ]);

  cleanup();
  assert.equal(listeners.has('nostr-connect-auth-challenge'), false);
});
