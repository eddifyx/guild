import test from 'node:test';
import assert from 'node:assert/strict';

import {
  api,
  apiNoAuth,
  getFileUrl,
  getAuthHeaders,
  getServerUrl,
  handleSessionExpiry,
  isInsecureConnection,
  resetSessionExpiry,
  setServerUrl,
  toServerConnectionError,
} from '../../../client/src/features/api/apiRuntime.mjs';

const RECOVERABLE_AUTH_CACHE_KEY = '__guildRecoverableAuthCache';

function createLocalStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

test('api runtime reuses configured server url and auth headers', async () => {
  const previousWindow = globalThis.window;
  const previousFetch = globalThis.fetch;
  const previousLocalStorage = globalThis.localStorage;

  const localStorage = createLocalStorage();
  const fetchCalls = [];

  globalThis.window = {
    location: { search: '' },
    localStorage,
    dispatchEvent: () => {},
  };
  globalThis.localStorage = localStorage;
  globalThis.fetch = async (url, options = {}) => {
    fetchCalls.push([url, options]);
    if (url.endsWith('/api/public')) {
      return {
        ok: true,
        json: async () => ({ public: true }),
        statusText: 'OK',
      };
    }
    return {
      ok: true,
      text: async () => JSON.stringify({ ok: true }),
      statusText: 'OK',
    };
  };

  try {
    setServerUrl('https://guild.test');
    localStorage.setItem('auth', JSON.stringify({
      userId: 'user-1',
      token: 'token-1',
    }));

    assert.equal(getServerUrl(), 'https://guild.test');
    assert.equal(isInsecureConnection(), false);
    assert.equal(
      getFileUrl('/uploads/file.png'),
      'https://guild.test/uploads/file.png?token=token-1'
    );

    assert.deepEqual(
      await api('/api/ping', {
        method: 'POST',
        body: JSON.stringify({ hello: 'world' }),
      }),
      { ok: true }
    );

    assert.deepEqual(
      await apiNoAuth('/api/public', {
        method: 'POST',
        body: JSON.stringify({ hi: true }),
      }),
      { public: true }
    );

    assert.deepEqual(fetchCalls, [
      [
        'https://guild.test/api/ping',
        {
          method: 'POST',
          body: JSON.stringify({ hello: 'world' }),
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer token-1',
          },
        },
      ],
      [
        'https://guild.test/api/public',
        {
          method: 'POST',
          body: JSON.stringify({ hi: true }),
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ],
    ]);

    assert.equal(toServerConnectionError(new TypeError('Failed to fetch'), 'https://guild.test').message.includes('Cannot reach the /guild server'), true);
  } finally {
    globalThis.window = previousWindow;
    globalThis.fetch = previousFetch;
    globalThis.localStorage = previousLocalStorage;
    if (previousWindow && typeof previousWindow === 'object') {
      previousWindow[RECOVERABLE_AUTH_CACHE_KEY] = null;
    }
    resetSessionExpiry();
  }
});

test('api runtime uses staged recoverable auth before desktop persistence completes', async () => {
  const previousWindow = globalThis.window;
  const previousFetch = globalThis.fetch;
  const previousLocalStorage = globalThis.localStorage;

  const localStorage = createLocalStorage();
  const fetchCalls = [];

  globalThis.window = {
    location: { search: '' },
    localStorage,
    electronAPI: {
      authStateGetSync: () => null,
      authStateSet: async () => true,
      authStateClear: async () => true,
    },
    dispatchEvent: () => {},
  };
  globalThis.localStorage = localStorage;
  globalThis.fetch = async (url, options = {}) => {
    fetchCalls.push([url, options]);
    return {
      ok: true,
      text: async () => JSON.stringify({ ok: true }),
      statusText: 'OK',
    };
  };

  try {
    setServerUrl('https://guild.test');
    window[RECOVERABLE_AUTH_CACHE_KEY] = {
      userId: 'user-2',
      token: 'token-2',
    };

    assert.deepEqual(getAuthHeaders(), {
      Authorization: 'Bearer token-2',
    });

    await api('/api/keys/bundle', {
      method: 'POST',
      body: JSON.stringify({ hello: 'world' }),
    });

    assert.deepEqual(fetchCalls, [
      [
        'https://guild.test/api/keys/bundle',
        {
          method: 'POST',
          body: JSON.stringify({ hello: 'world' }),
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer token-2',
          },
        },
      ],
    ]);
  } finally {
    globalThis.window = previousWindow;
    globalThis.fetch = previousFetch;
    globalThis.localStorage = previousLocalStorage;
    if (globalThis.window && typeof globalThis.window === 'object') {
      globalThis.window[RECOVERABLE_AUTH_CACHE_KEY] = null;
    }
    resetSessionExpiry();
  }
});

test('session expiry clears staged recoverable auth cache', async () => {
  const previousWindow = globalThis.window;
  const previousLocalStorage = globalThis.localStorage;

  const localStorage = createLocalStorage();
  const dispatched = [];

  globalThis.window = {
    location: { search: '' },
    localStorage,
    electronAPI: {
      authStateGetSync: () => null,
      authStateSet: async () => true,
      authStateClear: async () => true,
    },
    dispatchEvent: (event) => {
      dispatched.push(event?.type);
    },
  };
  globalThis.localStorage = localStorage;

  try {
    window[RECOVERABLE_AUTH_CACHE_KEY] = {
      userId: 'user-3',
      token: 'token-3',
    };

    assert.deepEqual(getAuthHeaders(), {
      Authorization: 'Bearer token-3',
    });

    handleSessionExpiry(401);

    assert.deepEqual(getAuthHeaders(), {});
    assert.deepEqual(dispatched, ['session-expired']);
  } finally {
    globalThis.window = previousWindow;
    globalThis.localStorage = previousLocalStorage;
    if (globalThis.window && typeof globalThis.window === 'object') {
      globalThis.window[RECOVERABLE_AUTH_CACHE_KEY] = null;
    }
    resetSessionExpiry();
  }
});

test('api runtime prefers the Electron launch-time server url over stale stored server selection', () => {
  const previousWindow = globalThis.window;
  const previousLocalStorage = globalThis.localStorage;

  const localStorage = createLocalStorage();

  globalThis.window = {
    location: { search: '?serverUrl=http%3A%2F%2Flocalhost%3A3001' },
    localStorage,
    electronAPI: {
      authStateGetSync: () => null,
    },
    dispatchEvent: () => {},
  };
  globalThis.localStorage = localStorage;

  try {
    localStorage.setItem('serverUrl', 'https://prod.guild.test');
    assert.equal(getServerUrl(), 'http://localhost:3001');
  } finally {
    globalThis.window = previousWindow;
    globalThis.localStorage = previousLocalStorage;
  }
});
