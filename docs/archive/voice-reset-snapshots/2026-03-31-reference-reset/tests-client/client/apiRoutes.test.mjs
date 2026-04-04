import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getKyberCount,
  getOTPCount,
  uploadPreKeyBundle,
  fetchPreKeyBundle,
  fetchDeviceIdentityRecords,
  fetchIdentityAttestation,
  replenishKyberPreKeys,
  replenishOTPs,
  resetEncryptionKeys,
} from '../../../client/src/features/api/apiKeyRoutes.mjs';
import {
  acceptFriendRequest,
  checkNpubs,
  deleteUploadedFile,
  getContacts,
  getIncomingRequests,
  getSentRequests,
  lookupUserByNpub,
  lookupUsersByNpubs,
  removeContact,
  rejectFriendRequest,
  sendFriendRequest,
} from '../../../client/src/features/api/apiSocialRoutes.mjs';

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

test('api key routes keep the keys endpoint contract intact', async () => {
  const previousWindow = globalThis.window;
  const previousFetch = globalThis.fetch;
  const previousLocalStorage = globalThis.localStorage;
  const localStorage = createLocalStorage();
  const calls = [];

  globalThis.window = { location: { search: '' }, localStorage, dispatchEvent: () => {} };
  globalThis.localStorage = localStorage;
  localStorage.setItem('serverUrl', 'https://guild.test');
  localStorage.setItem('auth', JSON.stringify({ userId: 'user-1', token: 'token-1' }));
  globalThis.fetch = async (url, options = {}) => {
    calls.push([url, options]);
    return {
      ok: true,
      text: async () => JSON.stringify({ users: [{ userId: 'user-2' }], count: 7 }),
      json: async () => ({ users: [{ userId: 'user-2' }], count: 7 }),
      statusText: 'OK',
    };
  };

  try {
    await uploadPreKeyBundle({ identityKey: 'abc' }, 'device-2');
    await fetchPreKeyBundle('user-2', 'device-2');
    await fetchIdentityAttestation('user-2');
    await fetchDeviceIdentityRecords('user-2');
    await getOTPCount('device-2');
    await getKyberCount('device-2');
    await resetEncryptionKeys();
    await replenishOTPs([{ id: 1 }], 'device-2');
    await replenishKyberPreKeys([{ id: 2 }], 'device-2');

    assert.equal(calls[0][0], 'https://guild.test/api/keys/bundle');
    assert.equal(calls[0][1].method, 'POST');
    assert.equal(calls[0][1].headers.Authorization, 'Bearer token-1');
    assert.equal(calls[0][1].body, JSON.stringify({ identityKey: 'abc', deviceId: 'device-2' }));
    assert.equal(calls[4][0], 'https://guild.test/api/keys/count?deviceId=device-2');
    assert.equal(calls[6][1].method, 'DELETE');
    assert.equal(calls[7][1].body, JSON.stringify({ oneTimePreKeys: [{ id: 1 }], deviceId: 'device-2' }));
    assert.equal(calls[8][1].body, JSON.stringify({ kyberPreKeys: [{ id: 2 }], deviceId: 'device-2' }));
  } finally {
    globalThis.window = previousWindow;
    globalThis.fetch = previousFetch;
    globalThis.localStorage = previousLocalStorage;
  }
});

test('api social routes keep lookup and friend request contracts intact', async () => {
  const previousWindow = globalThis.window;
  const previousFetch = globalThis.fetch;
  const previousLocalStorage = globalThis.localStorage;
  const localStorage = createLocalStorage();
  const calls = [];

  globalThis.window = { location: { search: '' }, localStorage, dispatchEvent: () => {} };
  globalThis.localStorage = localStorage;
  localStorage.setItem('serverUrl', 'https://guild.test');
  localStorage.setItem('auth', JSON.stringify({ userId: 'user-1', token: 'token-1' }));
  globalThis.fetch = async (url, options = {}) => {
    calls.push([url, options]);
    return {
      ok: true,
      text: async () => JSON.stringify({ users: [{ npub: 'npub1one' }], contacts: ['npub1friend'] }),
      json: async () => ({ users: [{ npub: 'npub1one' }], contacts: ['npub1friend'] }),
      statusText: 'OK',
    };
  };

  try {
    await checkNpubs(['npub1one']);
    assert.deepEqual(await lookupUsersByNpubs(['npub1one']), [{ npub: 'npub1one' }]);
    assert.deepEqual(await lookupUserByNpub('npub1one'), { npub: 'npub1one' });
    await getContacts();
    await removeContact('npub1friend');
    await sendFriendRequest('npub1friend');
    await getIncomingRequests();
    await getSentRequests();
    await acceptFriendRequest('request-1');
    await rejectFriendRequest('request-2');
    await deleteUploadedFile('file-1');

    assert.equal(calls[0][0], 'https://guild.test/api/users/check-npubs');
    assert.equal(calls[1][0], 'https://guild.test/api/users/lookup-npubs');
    assert.equal(calls[2][0], 'https://guild.test/api/users/lookup-npubs');
    assert.equal(calls[3][0], 'https://guild.test/api/contacts');
    assert.equal(calls[4][0], 'https://guild.test/api/contacts/npub1friend');
    assert.equal(calls[5][0], 'https://guild.test/api/friend-requests');
    assert.equal(calls[8][0], 'https://guild.test/api/friend-requests/request-1/accept');
    assert.equal(calls[9][0], 'https://guild.test/api/friend-requests/request-2/reject');
    assert.equal(calls[10][0], 'https://guild.test/api/files/file-1');
  } finally {
    globalThis.window = previousWindow;
    globalThis.fetch = previousFetch;
    globalThis.localStorage = previousLocalStorage;
  }
});
